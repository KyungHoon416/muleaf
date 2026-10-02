import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {randomBytes} from 'node:crypto';
import {createAuthServer} from '../src/app.mjs';
import {tokenCipher,hash} from '../src/store.mjs';
import {openStore} from '../src/firestore-store.mjs';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8085')throw Error('Tests require local Firestore emulator on 8085');
const firestore=getFirestore(initializeApp({projectId:'demo-muleaf-firestore'}));
function fixture(){
 let now=Date.now(),exchanges=0,revokes=0;
 const env={AUTH_PUBLIC_ORIGIN:'https://auth.example.test',SITE_ORIGIN:'https://app.example.test',NODE_ENV:'production',TOKEN_ENCRYPTION_KEY:randomBytes(32).toString('base64')};
 const oauth={configuredProviders:()=>['google','apple'],authorizationUrl:(p,e,f)=>`https://provider.test/?state=${f.state}`,exchange:async(p,e,f,code)=>{exchanges++;if(code==='invalid')throw Error('bad');return{subject:'subject-'+p,name:'Test User',email:'same@example.test',tokens:{refresh_token:'private-token'}};},revoke:async()=>{revokes++;}};
 const db=openStore(firestore,'test_'+randomBytes(8).toString('hex'));const {handler}=createAuthServer(env,{store:db,providers:oauth,now:()=>now});
 db.close=async()=>{for(const c of [db.users,db.sessions,db.flows,db.rates])await firestore.recursiveDelete(c);};
 async function request(path,{method='GET',cookie='',origin,csrf,body='',raw=false}={}){
  const req=Readable.from([body]);if(raw)req.rawBody=Buffer.from(body);req.url=path;req.method=method;req.socket={remoteAddress:'127.0.0.1'};req.headers={cookie,...origin?{origin}:{},...csrf?{'x-csrf-token':csrf}:{}};
  const res={headers:{},status:200,setHeader(k,v){this.headers[k.toLowerCase()]=v;},writeHead(s,h={}){this.status=s;for(const[k,v]of Object.entries(h))this.setHeader(k,v);},end(b=''){this.body=b;}};
  await handler(req,res);return res;
 }
 async function start(provider='google'){const r=await request('/api/auth/start/'+provider);return{state:new URL(r.headers.location).searchParams.get('state'),cookie:r.headers['set-cookie'].split(';')[0]};}
 async function login(provider='google'){const flow=await start(provider);const r=await request(`/api/auth/callback/${provider}?code=ok&state=${flow.state}`,{cookie:flow.cookie});return r.headers['set-cookie'].split(';')[0];}
 return{request,start,login,db,env,advance:ms=>now+=ms,counts:()=>({exchanges,revokes})};
}
test('state binding, expiry, replay and provider mix-up are rejected',async t=>{
 const f=fixture();t.after(()=>f.db.close());const a=await f.start();
 const bad=await f.request(`/api/auth/callback/google?code=ok&state=${a.state}`,{cookie:'__session=attacker'});assert.match(bad.headers.location,/invalid_state/);
 await f.request(`/api/auth/callback/apple?code=ok&state=${a.state}`,{cookie:a.cookie});assert.equal(f.counts().exchanges,0);
 const good=await f.request(`/api/auth/callback/google?code=ok&state=${a.state}`,{cookie:a.cookie});assert.equal(good.status,303);assert.equal(f.counts().exchanges,1);
 await f.request(`/api/auth/callback/google?code=ok&state=${a.state}`,{cookie:a.cookie});assert.equal(f.counts().exchanges,1);
 const expired=await f.start();f.advance(600001);await f.request(`/api/auth/callback/google?code=ok&state=${expired.state}`,{cookie:expired.cookie});assert.equal(f.counts().exchanges,1);
});
test('sessions use opaque hashed cookies, CSRF checks, and real logout',async t=>{
 const f=fixture();t.after(()=>f.db.close());const cookie=await f.login();
 let response=await f.request('/api/auth/session',{cookie});const data=JSON.parse(response.body);assert.equal(data.user.displayName,'Test User');assert(!response.body.includes('private-token'));assert(!response.body.includes('same@example.test'));
 const row=await f.db.sessions.doc(hash(cookie.slice(10))).get();assert(row.exists);
 assert.equal((await f.request('/api/auth/logout',{method:'POST',cookie,origin:'https://evil.test',csrf:data.csrfToken})).status,403);
 assert.equal((await f.request('/api/auth/logout',{method:'POST',cookie,origin:f.env.SITE_ORIGIN})).status,403);
 assert.equal((await f.request('/api/auth/logout',{method:'POST',cookie,origin:f.env.SITE_ORIGIN,csrf:data.csrfToken})).status,200);
 response=await f.request('/api/auth/session',{cookie});assert.equal(JSON.parse(response.body).user,null);
});
test('Apple form_post binds to secure transient cookie and identities never merge by email',async t=>{
 const f=fixture();t.after(()=>f.db.close());await f.login('google');const start=await f.start('apple');
 const response=await f.request('/api/auth/callback/apple',{method:'POST',cookie:start.cookie,body:new URLSearchParams({state:start.state,code:'ok'}).toString()});assert.equal(response.status,303);
 assert.equal((await f.db.users.get()).size,2);
 const r=await f.request('/api/auth/start/apple');assert.match(r.headers['set-cookie'],/HttpOnly; SameSite=None/);assert.match(r.headers['set-cookie'],/Secure/);
});
test('account deletion revokes provider and removes sessions; old login cannot delete',async t=>{
 const f=fixture();t.after(()=>f.db.close());let cookie=await f.login();let data=JSON.parse((await f.request('/api/auth/session',{cookie})).body);
 f.advance(900001);assert.equal((await f.request('/api/auth/account',{method:'DELETE',cookie,origin:f.env.SITE_ORIGIN,csrf:data.csrfToken})).status,401);assert.equal(f.counts().revokes,0);
 cookie=await f.login();data=JSON.parse((await f.request('/api/auth/session',{cookie})).body);
 assert.equal((await f.request('/api/auth/account',{method:'DELETE',cookie,origin:f.env.SITE_ORIGIN,csrf:data.csrfToken})).status,200);assert.equal(f.counts().revokes,1);assert.equal((await f.db.sessions.get()).size,0);assert.equal((await f.db.users.get()).size,0);
});
test('provider failure never creates a session; unknown providers do not redirect externally',async t=>{
 const f=fixture();t.after(()=>f.db.close());const a=await f.start();const r=await f.request(`/api/auth/callback/google?code=invalid&state=${a.state}`,{cookie:a.cookie});assert.match(r.headers.location,/login_failed/);assert.equal((await f.db.sessions.get()).size,0);
 const disabled=await f.request('/api/auth/start/naver?return_to=https://evil.test');assert.equal(new URL(disabled.headers.location).origin,f.env.SITE_ORIGIN);
 assert.equal((await f.request('/api/auth/session',{method:'OPTIONS',origin:'https://evil.test'})).status,403);
});
test('provider credentials are encrypted at rest and reject tampering',()=>{
 const cipher=tokenCipher(randomBytes(32).toString('base64'));const encrypted=cipher.seal({refresh_token:'secret'});assert(!encrypted.includes('secret'));assert.deepEqual(cipher.open(encrypted),{refresh_token:'secret'});const bytes=Buffer.from(encrypted,'base64');bytes[bytes.length-1]^=1;assert.throws(()=>cipher.open(bytes.toString('base64')));
});
test('Firestore transaction permits only one concurrent callback',async t=>{
 const f=fixture();t.after(()=>f.db.close());const flow=await f.start();
 await Promise.all(Array.from({length:5},()=>f.request(`/api/auth/callback/google?code=ok&state=${flow.state}`,{cookie:flow.cookie})));
 assert.equal(f.counts().exchanges,1);assert.equal((await f.db.sessions.get()).size,1);
});
test('TTL delay cannot extend a session and deleting latch blocks access',async t=>{
 const f=fixture();t.after(()=>f.db.close());const cookie=await f.login(),id=hash(cookie.slice(10));
 const session=await f.db.getSession(id,Date.now());await f.db.beginDelete(session);assert.equal(await f.db.getSession(id,Date.now()),null);
 await f.db.cancelDelete(session);assert(await f.db.getSession(id,Date.now()));
 f.advance(604800001);assert.equal(JSON.parse((await f.request('/api/auth/session',{cookie})).body).user,null);
});
test('Functions rawBody supports Apple form_post without reading consumed stream',async t=>{
 const f=fixture();t.after(()=>f.db.close());
 const flow=await f.start('apple');const res=await f.request('/api/auth/callback/apple',{method:'POST',cookie:flow.cookie,body:new URLSearchParams({state:flow.state,code:'ok'}).toString(),raw:true});assert.equal(res.status,303);assert.equal(f.counts().exchanges,1);
});
test('unauthenticated Firestore REST clients cannot read auth documents',async()=>{
 const response=await fetch('http://127.0.0.1:8085/v1/projects/demo-muleaf-firestore/databases/(default)/documents/muleaf_auth_users');assert.equal(response.status,403);
});
