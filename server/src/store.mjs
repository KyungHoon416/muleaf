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
