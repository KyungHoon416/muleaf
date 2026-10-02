import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
export const random = () => randomBytes(32).toString('base64url');
export const hash = value => createHash('sha256').update(value).digest('base64url');
export function tokenCipher(secret) {
  const key = Buffer.from(secret || '', 'base64'); if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 random bytes encoded as base64');
  return {
    seal(value) { const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64'); },
    open(value) { const b=Buffer.from(value,'base64'),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([d.update(b.subarray(28)),d.final()]).toString()); },
  };
}
export function openStore(path) {
  const db=new DatabaseSync(path); db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,provider TEXT NOT NULL,subject TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,tokens TEXT NOT NULL,created INTEGER NOT NULL,UNIQUE(provider,subject));
    CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL,authenticated INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS flows(state TEXT PRIMARY KEY,binding TEXT NOT NULL,provider TEXT NOT NULL,nonce TEXT NOT NULL,verifier TEXT NOT NULL,expires INTEGER NOT NULL);`);
  return db;
}
