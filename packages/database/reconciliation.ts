import {randomUUID} from 'node:crypto';
import type {Collection,Document} from 'mongodb';
import type {WorkerBinding} from './workers.js';
export interface AssistantObservation {assistantId:string;holderId:string;botId:string;chatId:string;generation:number}
const id=(s:unknown)=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(s);
const telegramId=(s:unknown)=>typeof s==='string'&&/^[1-9]\d{0,19}$/.test(s);
const generation=(n:number)=>Number.isSafeInteger(n)&&n>0;
/** Operator-only reconciliation of exact observations. Expiry marks suspect ownership, NOT proof of process death or cleanup.
 * Durable outbox is in the same document/update. Stop at 100 pending transitions rather
 * than dropping audit history. No automatic release, takeover or process-ID based inference.
 */
export class AbandonedOwnership {
 constructor(private readonly workers:Collection,private readonly assistants:Collection){}
 /** Bounded operator scan; returned counts describe quarantine, never native cleanup. */
 async scan(botId:string,limit=100):Promise<{inspected:number;quarantined:number}>{
  if(!telegramId(botId)||!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Error('RECONCILIATION_INVALID');
  const expired={botId,expiresAt:{$type:'date'},$expr:{$lte:['$expiresAt','$$NOW']}};
  const workers=await this.workers.find({...expired,state:{$in:['starting','ready']}},{projection:{botId:1,ownerId:1,workerId:1,generation:1}}).limit(limit).toArray();
  const assistants=await this.assistants.find({...expired,state:'leased',cleanupStatus:{$ne:'quarantined'}},{projection:{assistantId:1,holderId:1,botId:1,chatId:1,generation:1}}).limit(limit).toArray();
  let quarantined=0;
  for(const w of workers)if(await this.worker({botId:w.botId,ownerId:w.ownerId,workerId:w.workerId,generation:w.generation}))quarantined++;
  for(const a of assistants)if(await this.assistant({assistantId:a.assistantId,holderId:a.holderId,botId:a.botId,chatId:a.chatId,generation:a.generation}))quarantined++;
  return {inspected:workers.length+assistants.length,quarantined};
 }

 async worker(value:WorkerBinding):Promise<boolean>{
  if(!value||!telegramId(value.botId)||!telegramId(value.ownerId)||!id(value.workerId)||!generation(value.generation))throw new Error('RECONCILIATION_INVALID');
  const scope={botId:value.botId,ownerId:value.ownerId,workerId:value.workerId,generation:value.generation};
  const update:Document={$set:{state:'quarantined'},$push:{ownershipOutbox:{eventId:randomUUID(),type:'worker_abandoned',createdAt:new Date(),...scope}},$currentDate:{quarantinedAt:true}};
  const result=await this.workers.findOneAndUpdate({...scope,state:{$in:['starting','ready']},$expr:{$lte:['$expiresAt','$$NOW']},'ownershipOutbox.99':{$exists:false}},update);
  return result!==null;
 }
 async assistant(value:AssistantObservation):Promise<boolean>{
  if(!value||!telegramId(value.botId)||typeof value.chatId!=='string'||!/^-[1-9]\d{0,19}$/.test(value.chatId)||!id(value.assistantId)||!id(value.holderId)||!generation(value.generation))throw new Error('RECONCILIATION_INVALID');
  const scope={assistantId:value.assistantId,holderId:value.holderId,botId:value.botId,chatId:value.chatId,generation:value.generation};
  const update:Document={$set:{cleanupStatus:'quarantined'},$push:{ownershipOutbox:{eventId:randomUUID(),type:'assistant_abandoned',createdAt:new Date(),...scope}},$currentDate:{quarantinedAt:true}};
  const result=await this.assistants.findOneAndUpdate({...scope,state:'leased',cleanupStatus:{$ne:'quarantined'},$expr:{$lte:['$expiresAt','$$NOW']},'ownershipOutbox.99':{$exists:false}},update);
  return result!==null;
 }
}
