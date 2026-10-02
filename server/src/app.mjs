import { random, hash, tokenCipher } from './store.mjs';
import { openStore } from './firestore-store.mjs';
import * as providers from './providers.mjs';

export function createAuthServer(env, options={}) {
  const origin=new URL(env.AUTH_PUBLIC_ORIGIN).origin, site=new URL(env.SITE_ORIGIN).origin;
  const production=env.NODE_ENV==='production';
  if(production&&(!origin.startsWith('https://')||!site.startsWith('https://'))) throw new Error('Production requires HTTPS');
  const db=options.store||openStore();
  const cipher=tokenCipher(env.TOKEN_ENCRYPTION_KEY), oauth=options.providers||providers;
  const enabled=oauth.configuredProviders(env), clock=options.now||Date.now;
  const callback=p=>`${origin}/api/auth/callback/${p}`;
  const cookie=(value,flow=false)=>`__session=${value}; Path=/; HttpOnly; SameSite=${production&&flow?'None':'Lax'}; Max-Age=${flow?600:604800}${production?'; Secure':''}`;
  const expiredCookie=`__session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${production?'; Secure':''}`;
  function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
  function redirect(res,path){res.writeHead(303,{Location:path});res.end();}
  async function body(req){if(req.rawBody){if(req.rawBody.length>16384)throw Error('body_limit');return new URLSearchParams(req.rawBody.toString('utf8'));}let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16384)throw Error('body_limit');}return new URLSearchParams(raw);}
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
    let session=null;
    const end=url.pathname.match(/^\/api\/auth\/callback\/(google|apple|naver|kakao)$/);
    try {
      session=sessionToken?await db.getSession(hash(sessionToken),now):null;
      if(url.pathname==='/healthz'&&req.method==='GET')return json(res,200,{ok:true});
      if(url.pathname==='/api/auth/session'&&req.method==='GET')return json(res,200,{user:session?{id:session.user_id,displayName:session.name,provider:session.provider}:null,csrfToken:session?.csrf||null,providers:enabled});
      const start=url.pathname.match(/^\/api\/auth\/start\/(google|apple|naver|kakao)$/);
      if(start&&req.method==='GET'){
        const provider=start[1];if(!enabled.includes(provider))return redirect(res,`${site}/?auth_error=provider_unavailable`);
        if(await db.rateLimited(req.ip||req.socket.remoteAddress||'unknown',now))return json(res,429,{error:'too_many_requests'});
        // Starting a new login replaces the current browser session (no implicit account linking).
        if(session)await db.deleteSession(session.id);
        const binding=random(),state=random(),nonce=random(),verifier=random();
        await db.putFlow(hash(state),{binding:hash(binding),provider,nonce,verifier,expires:now+600000});
        res.setHeader('Set-Cookie',cookie(binding,true));
        return redirect(res,oauth.authorizationUrl(provider,env,{state,nonce,verifier,challenge:hash(verifier)},callback(provider)));
      }
      if(end&&(req.method==='GET'||req.method==='POST')){
        const provider=end[1];const params=req.method==='POST'?await body(req):url.searchParams;
        const state=params.get('state');if(!state||state.length>200||!sessionToken)return redirect(res,`${site}/?auth_error=invalid_state`);
        // Atomic consume also rejects replay/concurrent callback requests.
        const flow=await db.consumeFlow(hash(state),hash(sessionToken),provider,now);
        if(!flow)return redirect(res,`${site}/?auth_error=invalid_state`);
        res.setHeader('Set-Cookie',expiredCookie);
        if(params.has('error'))return redirect(res,`${site}/?auth_error=cancelled`);
        const code=params.get('code');if(!code||code.length>8192||!enabled.includes(provider))return redirect(res,`${site}/?auth_error=login_failed`);
        const identity=await oauth.exchange(provider,env,{...flow,state},code,callback(provider),params.get('user'));
        const token=random();await db.completeLogin(provider,identity,cipher,hash(token),random(),now);
        res.setHeader('Set-Cookie',cookie(token));return redirect(res,site+'/');
      }
      if(['/api/auth/logout','/api/auth/account'].includes(url.pathname)){
        if((url.pathname.endsWith('logout')&&req.method!=='POST')||(url.pathname.endsWith('account')&&req.method!=='DELETE'))return json(res,405,{error:'method_not_allowed'});
        if(!session)return json(res,401,{error:'sign_in_required'});
        if(suppliedOrigin!==site||req.headers['x-csrf-token']!==session.csrf)return json(res,403,{error:'csrf_failed'});
        if(url.pathname.endsWith('account')){
          if(now-session.authenticated>900000)return json(res,401,{error:'recent_login_required'});
          const user=await db.beginDelete(session);
          try { await oauth.revoke(user.provider,env,cipher.open(user.tokens)); } catch(error) { await db.cancelDelete(session); throw error; }
          await db.finishDelete(session);
        }else await db.deleteSession(session.id);
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
