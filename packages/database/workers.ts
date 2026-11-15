import {ownershipCapacity,ownershipEvent} from './ownership-events.js';
import {createHash} from 'node:crypto';
import type {Collection} from 'mongodb';
export interface WorkerBinding {botId:string;ownerId:string;workerId:string;generation:number}
const identity=(value:unknown):value is string=>typeof value==='string'&&/^[1-9]\d{0,19}$/.test(value);
const workerIdValid=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
/** Internal controller registry, NOT an untrusted HTTP API. Provision grants/slots separately.
 * Expired workers cannot be stolen. Trusted cleanup/reconciliation is still required.
 */
export class WorkerRegistry {
 constructor(private readonly grants:Collection,private readonly bots:Collection,private readonly workers:Collection){}
 private hash(token:string):string{
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(token))throw new Error('WORKER_UNAUTHORIZED');
  return createHash('sha256').update(token).digest('hex');
 }
 private binding(value:WorkerBinding):WorkerBinding{
  if(!value||!identity(value.botId)||!identity(value.ownerId)||!workerIdValid(value.workerId)||!Number.isSafeInteger(value.generation)||value.generation<1)throw new Error('WORKER_BINDING_INVALID');
  // Explicit projection prevents extra caller properties overriding DB predicates.
  return {botId:value.botId,ownerId:value.ownerId,workerId:value.workerId,generation:value.generation};
 }
 private async authorize(tokenHash:string):Promise<{botId:string;ownerId:string}>{
  const grant=await this.grants.findOne({tokenHash,enabled:true});
  if(!grant||!identity(grant.botId)||!identity(grant.ownerId)||!await this.bots.findOne({botId:grant.botId,ownerId:grant.ownerId,suspended:{$ne:true}}))throw new Error('WORKER_UNAUTHORIZED');
  return {botId:grant.botId,ownerId:grant.ownerId};
 }
 async ensureIndexes():Promise<void>{
  await this.grants.createIndex({tokenHash:1},{unique:true});
  await this.workers.createIndex({botId:1},{unique:true});
 }
 async claim(token:string,workerId:string):Promise<WorkerBinding>{
  const grantHash=this.hash(token);
  if(!workerIdValid(workerId))throw new Error('WORKER_UNAUTHORIZED');
  const scope=await this.authorize(grantHash);
  const claimed=await this.workers.findOneAndUpdate({...ownershipCapacity,...scope,state:'stopped',generation:{$lt:Number.MAX_SAFE_INTEGER,$gte:0}},[{$set:{workerId:{$literal:workerId},grantHash:{$literal:grantHash},state:'starting',generation:{$add:['$generation',1]},heartbeatAt:'$$NOW',expiresAt:{$add:['$$NOW',30000]}}},ownershipEvent('worker_claimed')],{returnDocument:'after'});
  if(!claimed)throw new Error('WORKER_BUSY_OR_QUARANTINED');
  return this.binding({botId:claimed.botId,ownerId:claimed.ownerId,workerId:claimed.workerId,generation:claimed.generation});
 }
 async heartbeat(value:WorkerBinding,ready:boolean,token:string):Promise<void>{
  const binding=this.binding(value),grantHash=this.hash(token);
  if(typeof ready!=='boolean')throw new Error('WORKER_BINDING_INVALID');
  // Check grant revocation/suspension BEFORE extending the worker deadline.
  const scope=await this.authorize(grantHash);
  if(scope.botId!==binding.botId||scope.ownerId!==binding.ownerId)throw new Error('WORKER_UNAUTHORIZED');
  const active=await this.workers.findOneAndUpdate({...ownershipCapacity,...binding,grantHash,state:{$in:['starting','ready']},$expr:{$gt:['$expiresAt','$$NOW']}},[{$set:{state:ready?'ready':'starting',heartbeatAt:'$$NOW',expiresAt:{$add:['$$NOW',30000]}}},ownershipEvent('worker_heartbeat')]);
  if(!active)throw new Error('WORKER_OWNERSHIP_LOST');
 }
 /** Trusted supervisor only. clean requires native cleanup/reap evidence, not a tenant bool.
  * Revoked workers may finish cleanup, but must prove the exact token/holder/generation.
  */
 async finish(value:WorkerBinding,clean:boolean,token:string):Promise<void>{
  const binding=this.binding(value),grantHash=this.hash(token);
  if(typeof clean!=='boolean')throw new Error('WORKER_BINDING_INVALID');
  const result=await this.workers.updateOne({...ownershipCapacity,...binding,grantHash,state:{$in:['starting','ready']}},[ownershipEvent(clean?'worker_stopped':'worker_quarantined'),{$set:{state:clean?'stopped':'quarantined',heartbeatAt:'$$NOW'}},{$unset:['expiresAt','grantHash']}]);
  if(result.matchedCount!==1)throw new Error('WORKER_OWNERSHIP_LOST');
 }
}
