import { createRemoteJWKSet, jwtVerify, importPKCS8, SignJWT } from 'jose';

const definitions = {
  google: { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', scope: 'openid email profile', issuer: ['https://accounts.google.com', 'accounts.google.com'], jwks: 'https://www.googleapis.com/oauth2/v3/certs' },
  apple: { authorize: 'https://appleid.apple.com/auth/authorize', token: 'https://appleid.apple.com/auth/token', scope: 'name email', issuer: 'https://appleid.apple.com', jwks: 'https://appleid.apple.com/auth/keys' },
  naver: { authorize: 'https://nid.naver.com/oauth2.0/authorize', token: 'https://nid.naver.com/oauth2.0/token', profile: 'https://openapi.naver.com/v1/nid/me' },
  kakao: { authorize: 'https://kauth.kakao.com/oauth/authorize', token: 'https://kauth.kakao.com/oauth/token', profile: 'https://kapi.kakao.com/v2/user/me', scope: 'profile_nickname' },
};
const keys = new Map();
async function request(url, options) {
  const response = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(10000) });
  const text = await response.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch { throw new Error('provider_response'); }
  if (!response.ok || body.error) throw new Error('provider_request');
  return body;
}
const form = (values) => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values) });
export function configuredProviders(env) {
  return Object.keys(definitions).filter(p => env[`${p.toUpperCase()}_CLIENT_ID`] && (p === 'apple' ? env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY : env[`${p.toUpperCase()}_CLIENT_SECRET`]));
}
async function client(p, env) {
  const id = env[`${p.toUpperCase()}_CLIENT_ID`];
  if (p !== 'apple') return { client_id: id, client_secret: env[`${p.toUpperCase()}_CLIENT_SECRET`] };
  const key = await importPKCS8(env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'ES256');
  const secret = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: env.APPLE_KEY_ID }).setIssuer(env.APPLE_TEAM_ID).setSubject(id).setAudience('https://appleid.apple.com').setIssuedAt().setExpirationTime('5m').sign(key);
  return { client_id: id, client_secret: secret };
}
export function authorizationUrl(p, env, flow, callback) {
  const d = definitions[p]; const url = new URL(d.authorize);
  const params = { client_id: env[`${p.toUpperCase()}_CLIENT_ID`], redirect_uri: callback, response_type: 'code', state: flow.state };
  if (d.scope) params.scope = d.scope;
  if (p === 'google' || p === 'apple') params.nonce = flow.nonce;
  if (p === 'google') { params.code_challenge = flow.challenge; params.code_challenge_method = 'S256'; params.access_type = 'offline'; params.prompt = 'select_account consent'; }
  if (p === 'apple') params.response_mode = 'form_post';
  url.search = new URLSearchParams(params).toString(); return url.href;
}
export async function exchange(p, env, flow, code, callback, appleUser) {
  const d = definitions[p]; const params = { ...await client(p, env), grant_type: 'authorization_code', code, redirect_uri: callback };
  if (p === 'google') params.code_verifier = flow.verifier;
  if (p === 'naver') params.state = flow.state;
  const tokens = await request(d.token, form(params));
  let subject, name, email;
  if (d.jwks) {
    if (!keys.has(p)) keys.set(p, createRemoteJWKSet(new URL(d.jwks)));
    const { payload } = await jwtVerify(tokens.id_token, keys.get(p), { issuer: d.issuer, audience: params.client_id, algorithms: ['RS256'], requiredClaims: ['sub', 'exp', 'iat', 'nonce'] });
    if (payload.nonce !== flow.nonce) throw new Error('invalid_nonce');
    subject = payload.sub; name = payload.name;
    if (payload.email_verified === true || payload.email_verified === 'true') email = payload.email;
    if (p === 'apple' && appleUser) {
      try { const value = JSON.parse(appleUser); name = [value.name?.firstName, value.name?.lastName].filter(v => typeof v === 'string').join(' '); } catch { /* The signed identity remains authoritative. */ }
    }
  } else {
    if (typeof tokens.access_token !== 'string') throw new Error('missing_token');
    const profile = await request(d.profile, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (p === 'naver') { if (profile.resultcode !== '00') throw new Error('invalid_profile'); subject = profile.response?.id; name = profile.response?.nickname; }
    if (p === 'kakao') { subject = profile.id; name = profile.kakao_account?.profile?.nickname; }
    // Naver/Kakao email is not used to link accounts or establish identity.
  }
  if (!['string', 'number'].includes(typeof subject) || !String(subject) || String(subject).length > 255) throw new Error('invalid_subject');
  return { subject: String(subject), name: typeof name === 'string' ? name.slice(0,100) : '', email: typeof email === 'string' ? email.slice(0,254) : '', tokens };
}
export async function revoke(p, env, tokens) {
  const credentials = await client(p, env);
  if (p === 'apple') {
    const token = tokens.refresh_token || tokens.access_token; if (!token) throw new Error('missing_token');
    await request('https://appleid.apple.com/auth/revoke', form({ ...credentials, token, token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token' })); return;
  }
  if (p === 'google') {
    const token = tokens.refresh_token || tokens.access_token; if (!token) throw new Error('missing_token');
    await request('https://oauth2.googleapis.com/revoke', form({ token })); return;
  }
  let access = tokens.access_token;
  if (tokens.refresh_token) {
    const fresh = await request(definitions[p].token, form({ ...credentials, grant_type: 'refresh_token', refresh_token: tokens.refresh_token })); access = fresh.access_token;
  }
  if (!access) throw new Error('missing_token');
  if (p === 'naver') { const body = await request(definitions.naver.token, form({ ...credentials, grant_type: 'delete', access_token: access, service_provider: 'NAVER' })); if (body.result !== 'success') throw new Error('revoke_failed'); }
  else await request('https://kapi.kakao.com/v1/user/unlink', { method: 'POST', headers: { Authorization: `Bearer ${access}` } });
}
