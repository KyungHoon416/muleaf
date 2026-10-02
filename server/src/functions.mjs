import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { createAuthServer } from './app.mjs';
const config = defineSecret('MULEAF_OAUTH_CONFIG');
let app;
export const socialAuth = onRequest({region:'asia-northeast3',memory:'256MiB',timeoutSeconds:60,maxInstances:3,minInstances:0,secrets:[config]},async(req,res)=>{
  try {
    if(!app){const settings=JSON.parse(config.value());app=createAuthServer({...settings,NODE_ENV:'production',AUTH_PUBLIC_ORIGIN:'https://muleaf-ed246.web.app',SITE_ORIGIN:'https://muleaf-ed246.web.app'});}
    await app.handler(req,res);
  }catch{res.setHeader('Cache-Control','no-store');res.status(503).json({error:'authentication_unavailable'});}
});
