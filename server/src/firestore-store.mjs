import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { hash, random } from './store.mjs';

export function openStore(database, prefix='muleaf_auth') {
  const db=database||getFirestore(getApps()[0]||initializeApp());
  const users=db.collection(`${prefix}_users`), sessions=db.collection(`${prefix}_sessions`), flows=db.collection(`${prefix}_flows`), rates=db.collection(`${prefix}_rates`);
  return {
    db, users, sessions, flows, rates,
    async getSession(id,now){const s=(await sessions.doc(id).get()).data();if(!s||s.expires<=now)return null;const user=(await users.doc(s.userDoc).get()).data();return user&&user.id===s.user_id&&!user.deleting?{...s,id,provider:user.provider,name:user.name,email:user.email}:null;},
    async deleteSession(id){await sessions.doc(id).delete();},
    async putFlow(state,data){await flows.doc(state).create({...data,expireAt:Timestamp.fromMillis(data.expires)});},
    async consumeFlow(state,binding,provider,now){return db.runTransaction(async tx=>{const ref=flows.doc(state),flow=(await tx.get(ref)).data();if(!flow||flow.binding!==binding||flow.provider!==provider||flow.expires<=now)return null;tx.delete(ref);return flow;});},
    async rateLimited(key,now){const ref=rates.doc(hash(key+':'+Math.floor(now/60000)));return db.runTransaction(async tx=>{const old=(await tx.get(ref)).data();const count=(old?.count||0)+1;tx.set(ref,{count,expireAt:Timestamp.fromMillis(now+120000)});return count>30;});},
    async completeLogin(provider,identity,cipher,sessionId,csrf,now){
      const userDoc=hash(provider+':'+identity.subject),ref=users.doc(userDoc);
      await db.runTransaction(async tx=>{
        const old=(await tx.get(ref)).data();if(old?.deleting)throw Error('account_deleting');
        const tokens={...identity.tokens};if(old&&!tokens.refresh_token)tokens.refresh_token=cipher.open(old.tokens).refresh_token;
        const user={id:old?.id||random(),provider,subject:identity.subject,name:identity.name||old?.name||'뮤리프 회원',email:identity.email||old?.email||'',tokens:cipher.seal(tokens),created:old?.created||now};
        tx.set(ref,user);tx.create(sessions.doc(sessionId),{userDoc,user_id:user.id,csrf,authenticated:now,expires:now+604800000,expireAt:Timestamp.fromMillis(now+604800000)});
      });
    },
    async beginDelete(session){return db.runTransaction(async tx=>{const ref=users.doc(session.userDoc),u=(await tx.get(ref)).data();if(!u||u.id!==session.user_id||u.deleting)throw Error('account_changed');tx.update(ref,{deleting:true});return u;});},
    async cancelDelete(session){await db.runTransaction(async tx=>{const ref=users.doc(session.userDoc),u=(await tx.get(ref)).data();if(u?.id===session.user_id)tx.update(ref,{deleting:false});});},
    async finishDelete(session){
      // Deleting latch blocks new sessions before all old sessions are removed.
      while(true){const page=await sessions.where('user_id','==',session.user_id).limit(400).get();if(page.empty)break;const batch=db.batch();for(const doc of page.docs)batch.delete(doc.ref);await batch.commit();}
      await db.runTransaction(async tx=>{const ref=users.doc(session.userDoc),u=(await tx.get(ref)).data();if(u?.id===session.user_id)tx.delete(ref);});
    },
  };
}
