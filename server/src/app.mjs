import { random, hash, tokenCipher, openStore } from './store.mjs';
import * as providers from './providers.mjs';

export function createAuthServer(env, options={}) {
  const origin=new URL(env.AUTH_PUBLIC_ORIGIN).origin, site=new URL(env.SITE_ORIGIN).origin;
  const production=env.NODE_ENV==='production';
  if(production&&(!origin.startsWith('https://')||!site.startsWith('https://'))) throw new Error('Production requires HTTPS');
  const db=options.db||openStore(env.DATABASE_PATH||'data/auth.sqlite');
  const cipher=tokenCipher(env.TOKEN_ENCRYPTION_KEY), oauth=options.providers||providers;
  const enabled=oauth.configuredProviders(env), clock=options.now||Date.now;
  const callback=p=>`${origin}/api/auth/callback/${p}`;
  const cookie=(value,flow=false)=>`__session=${value}; Path=/; HttpOnly; SameSite=${production&&flow?'None':'Lax'}; Max-Age=${flow?600:604800}${production?'; Secure':''}`;
  const expiredCookie=`__session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${production?'; Secure':''}`;
  function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
  function redirect(res,path){res.writeHead(303,{Location:path});res.end();}
  async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16384)throw Error('body_limit');}return new URLSearchParams(raw);}
  const failures=new Map();
  function rateLimited(key) {
    const now=clock();for(const [k,v]of failures)if(v.until<now)failures.delete(k);
    const value=failures.get(key)||{count:0,until:now+60000};value.count++;failures.set(key,value);return value.count>30;
  }
  const handler=async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    const suppliedOrigin=req.headers.origin;
    if(suppliedOrigin===site){res.setHeader('Access-Control-Allow-Origin',site);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){if(suppliedOrigin!==site)return json(res,403,{error:'origin_denied'});res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-CSRF-Token');res.writeHead(204);return res.end();}
    const url=new URL(req.url,origin), now=clock();
    // Never trust forwarded hosts or client-supplied redirect destinations.
    const cookieValues=(req.headers.cookie||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith('__session='));
    const sessionToken=cookieValues.length===1?cookieValues[0].slice(10):'';
    const session=sessionToken?db.prepare('SELECT s.*,u.provider,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires>?').get(hash(sessionToken),now):null;
    db.prepare('DELETE FROM flows WHERE expires<?').run(now);db.prepare('DELETE FROM sessions WHERE expires<?').run(now);
    const end=url.pathname.match(/^\/api\/auth\/callback\/(google|apple|naver|kakao)$/);
    try {
      if(url.pathname==='/healthz'&&req.method==='GET')return json(res,200,{ok:true});
      if(url.pathname==='/api/auth/session'&&req.method==='GET')return json(res,200,{user:session?{id:session.user_id,displayName:session.name,provider:session.provider}:null,csrfToken:session?.csrf||null,providers:enabled});
      const start=url.pathname.match(/^\/api\/auth\/start\/(google|apple|naver|kakao)$/);
      if(start&&req.method==='GET'){
        const provider=start[1];if(!enabled.includes(provider))return redirect(res,`${site}/?auth_error=provider_unavailable`);
        if(rateLimited(req.socket.remoteAddress||'unknown'))return json(res,429,{error:'too_many_requests'});
        // Starting a new login replaces the current browser session (no implicit account linking).
        if(session)db.prepare('DELETE FROM sessions WHERE id=?').run(session.id);
        const binding=random(),state=random(),nonce=random(),verifier=random();
        db.prepare('INSERT INTO flows VALUES(?,?,?,?,?,?)').run(hash(state),hash(binding),provider,nonce,verifier,now+600000);
        res.setHeader('Set-Cookie',cookie(binding,true));
        return redirect(res,oauth.authorizationUrl(provider,env,{state,nonce,verifier,challenge:hash(verifier)},callback(provider)));
      }
      if(end&&(req.method==='GET'||req.method==='POST')){
        const provider=end[1];const params=req.method==='POST'?await body(req):url.searchParams;
        const state=params.get('state');if(!state||state.length>200||!sessionToken)return redirect(res,`${site}/?auth_error=invalid_state`);
        // Atomic consume also rejects replay/concurrent callback requests.
        const flow=db.prepare('DELETE FROM flows WHERE state=? AND binding=? AND provider=? AND expires>? RETURNING *').get(hash(state),hash(sessionToken),provider,now);
        if(!flow)return redirect(res,`${site}/?auth_error=invalid_state`);
        res.setHeader('Set-Cookie',expiredCookie);
        if(params.has('error'))return redirect(res,`${site}/?auth_error=cancelled`);
        const code=params.get('code');if(!code||code.length>8192||!enabled.includes(provider))return redirect(res,`${site}/?auth_error=login_failed`);
        const identity=await oauth.exchange(provider,env,{...flow,state},code,callback(provider),params.get('user'));
        let user=db.prepare('SELECT * FROM users WHERE provider=? AND subject=?').get(provider,identity.subject);
        if(user){const old=cipher.open(user.tokens);identity.tokens.refresh_token ||= old.refresh_token;
          db.prepare('UPDATE users SET name=?,email=?,tokens=? WHERE id=?').run(identity.name||user.name,identity.email||user.email,cipher.seal(identity.tokens),user.id);
        }else{user={id:random()};db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run(user.id,provider,identity.subject,identity.name||'뮤리프 회원',identity.email,cipher.seal(identity.tokens),now);}
        const token=random();db.prepare('INSERT INTO sessions VALUES(?,?,?,?,?)').run(hash(token),user.id,random(),now+604800000,now);
        res.setHeader('Set-Cookie',cookie(token));return redirect(res,site+'/');
      }
      if(['/api/auth/logout','/api/auth/account'].includes(url.pathname)){
        if((url.pathname.endsWith('logout')&&req.method!=='POST')||(url.pathname.endsWith('account')&&req.method!=='DELETE'))return json(res,405,{error:'method_not_allowed'});
        if(!session)return json(res,401,{error:'sign_in_required'});
        if(suppliedOrigin!==site||req.headers['x-csrf-token']!==session.csrf)return json(res,403,{error:'csrf_failed'});
        if(url.pathname.endsWith('account')){
          if(now-session.authenticated>900000)return json(res,401,{error:'recent_login_required'});
          const user=db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id);
          await oauth.revoke(user.provider,env,cipher.open(user.tokens));
          db.prepare('DELETE FROM users WHERE id=?').run(user.id);
        }else db.prepare('DELETE FROM sessions WHERE id=?').run(session.id);
        res.setHeader('Set-Cookie',expiredCookie);return json(res,200,{ok:true});
      }
      return json(res,404,{error:'not_found'});
    }catch(error){
      // Do not log OAuth codes, profile data, cookies, secrets, or provider responses.
      options.onError?.(error);
      if(end)return redirect(res,`${site}/?auth_error=login_failed`);
      return json(res,502,{error:'request_failed'});
    }
  };
  return {handler,db};
}
