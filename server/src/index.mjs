import { createServer } from 'node:http';
import { createAuthServer } from './app.mjs';
const env=process.env;
const {handler,db}=createAuthServer(env);
const server=createServer((req,res)=>{handler(req,res).catch(()=>{if(!res.headersSent)res.writeHead(500);res.end();});});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(Number(env.PORT||8080),env.HOST||'127.0.0.1',()=>console.log('Muleaf authentication server listening'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{void db.db.terminate();process.exit(0);}));
