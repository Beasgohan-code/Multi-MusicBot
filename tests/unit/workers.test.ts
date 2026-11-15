import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Collection,Document} from 'mongodb';
import {WorkerRegistry} from '../../packages/database/workers.js';
test('worker claim derives ownership from server grant, never caller tenant fields',async()=>{
 const filters:Document[]=[];
 const grants={async findOne(filter:Document){assert.equal(typeof filter.tokenHash,'string');assert.equal(filter.tokenHash.length,64);return {botId:'123',ownerId:'456',enabled:true};}} as unknown as Collection;
 const bots={async findOne(filter:Document){assert.deepEqual(filter,{botId:'123',ownerId:'456',suspended:{$ne:true}});return {botId:'123'};}} as unknown as Collection;
 const workers={async findOneAndUpdate(filter:Document){filters.push(filter);return {botId:'123',ownerId:'456',workerId:'w1',generation:1,state:'starting'};}} as unknown as Collection;
 const registry=new WorkerRegistry(grants,bots,workers);
 const registered=await registry.claim('x'.repeat(43),'w1');assert.equal(registered.botId,'123');
 assert.deepEqual(filters[0],{'ownershipOutbox.99':{$exists:false},botId:'123',ownerId:'456',state:'stopped',generation:{$lt:Number.MAX_SAFE_INTEGER,$gte:0}});
});
test('revoked/missing grants do not touch worker ownership and duplicate claim fails closed',async()=>{
 const registry=new WorkerRegistry({findOne:async()=>null} as unknown as Collection,{} as Collection,{} as Collection);
 await assert.rejects(registry.claim('x'.repeat(43),'w1'),/WORKER_UNAUTHORIZED/);
 await assert.rejects(registry.claim('short','w1'),/WORKER_UNAUTHORIZED/);
});

test('heartbeat rejects a revoked grant before extending worker ownership',async()=>{
 let writes=0;
 const registry=new WorkerRegistry({findOne:async()=>null} as unknown as Collection,{} as Collection,{findOneAndUpdate:async()=>{writes++;return {};}} as unknown as Collection);
 await assert.rejects(registry.heartbeat({botId:'123',ownerId:'456',workerId:'w1',generation:1},true,'x'.repeat(43)),/WORKER_UNAUTHORIZED/);
 assert.equal(writes,0);
});
test('heartbeat checks authenticated tenant, grant and generation before renewal',async()=>{
 const calls:string[]=[];let filter:Document|undefined;
 const registry=new WorkerRegistry({findOne:async()=>{calls.push('grant');return {botId:'123',ownerId:'456',enabled:true};}} as unknown as Collection,
 {findOne:async()=>{calls.push('bot');return {};}} as unknown as Collection,
 {findOneAndUpdate:async(f:Document)=>{calls.push('renew');filter=f;return {};}} as unknown as Collection);
 const binding={botId:'123',ownerId:'456',workerId:'w1',generation:2};
 await registry.heartbeat(binding,true,'x'.repeat(43));
 assert.deepEqual(calls,['grant','bot','renew']);assert.equal(filter?.generation,2);
 assert.equal(typeof filter?.grantHash,'string');assert.deepEqual(filter?.$expr,{$gt:['$expiresAt','$$NOW']});
 calls.length=0;
 await assert.rejects(registry.heartbeat({...binding,botId:'999'},true,'x'.repeat(43)),/WORKER_UNAUTHORIZED/);
 assert.ok(!calls.includes('renew'));
});
test('invalid worker bindings fail before database access',async()=>{
 const registry=new WorkerRegistry({} as Collection,{} as Collection,{} as Collection);
 for(const generation of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1]){
  await assert.rejects(registry.heartbeat({botId:'123',ownerId:'456',workerId:'w1',generation},true,'x'.repeat(43)),/WORKER_BINDING_INVALID/);
 }
});
test('cleanup finish is token-fenced, including after grant revocation',async()=>{
 let filter:Document|undefined;let update:Document|undefined;
 const registry=new WorkerRegistry({} as Collection,{} as Collection,{updateOne:async(f:Document,u:Document)=>{filter=f;update=u;return {matchedCount:1};}} as unknown as Collection);
 await registry.finish({botId:'123',ownerId:'456',workerId:'w1',generation:2},false,'x'.repeat(43));
 assert.equal(typeof filter?.grantHash,'string');assert.equal(filter?.generation,2);
 assert.equal(update?.[1].$set.state,'quarantined');
});
test('suspended bot or database outage cannot renew a worker',async()=>{
 for(const outage of [false,true]){
  let writes=0;
  const registry=new WorkerRegistry({findOne:async()=>({botId:'123',ownerId:'456'})} as unknown as Collection,
   {findOne:async()=>{if(outage)throw new Error('DB_UNAVAILABLE');return null;}} as unknown as Collection,
   {findOneAndUpdate:async()=>{writes++;return {};}} as unknown as Collection);
  await assert.rejects(registry.heartbeat({botId:'123',ownerId:'456',workerId:'w1',generation:1},true,'x'.repeat(43)),outage?/DB_UNAVAILABLE/:/WORKER_UNAUTHORIZED/);
  assert.equal(writes,0);
 }
});
test('expired/stale workers cannot heartbeat or clear another holder',async()=>{
 const registry=new WorkerRegistry({findOne:async()=>({botId:'123',ownerId:'456'})} as unknown as Collection,
 {findOne:async()=>({})} as unknown as Collection,
 {findOneAndUpdate:async()=>null,updateOne:async()=>({matchedCount:0})} as unknown as Collection);
 const binding={botId:'123',ownerId:'456',workerId:'w1',generation:1};
 await assert.rejects(registry.heartbeat(binding,true,'x'.repeat(43)),/WORKER_OWNERSHIP_LOST/);
 await assert.rejects(registry.finish(binding,true,'x'.repeat(43)),/WORKER_OWNERSHIP_LOST/);
 await assert.rejects(registry.claim('x'.repeat(43),'w2'),/WORKER_BUSY_OR_QUARANTINED/);
});
