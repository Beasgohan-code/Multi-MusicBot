import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Collection,Document} from 'mongodb';
import {AssistantLeases,type AssistantRecord} from '../../packages/database/leases.js';
import {WorkerRegistry} from '../../packages/database/workers.js';
test('assistant ownership mutations append durable audit atomically with backpressure',async()=>{
 const calls:{f:Document;u:unknown}[]=[];
 const c={findOneAndUpdate:async(f:Document,u:unknown)=>{calls.push({f,u});return {generation:1};}} as unknown as Collection<AssistantRecord>;
 const leases=new AssistantLeases(c);
 await leases.acquire('a','w1','123','-1001',30000);await leases.renew('a','w1',1,30000);await leases.releaseAfterCleanup('a','w1',1);
 for(const [i,type] of ['assistant_acquired','assistant_renewed','assistant_released'].entries()){
  assert.deepEqual(calls[i]!.f['ownershipOutbox.99'],{$exists:false});
  const update=JSON.stringify(calls[i]!.u);assert.ok(update.includes(type));assert.ok(update.includes('ownershipOutbox'));assert.ok(update.includes('$$NOW'));
  assert.ok(!update.includes('secretRef'));
 }
});
test('worker registration heartbeat and finish append safe atomic transition events',async()=>{
 const calls:{f:Document;u:unknown}[]=[];
 const workers={findOneAndUpdate:async(f:Document,u:unknown)=>{calls.push({f,u});return {botId:'123',ownerId:'456',workerId:'w1',generation:1};},updateOne:async(f:Document,u:unknown)=>{calls.push({f,u});return {matchedCount:1};}} as unknown as Collection;
 const registry=new WorkerRegistry({findOne:async()=>({botId:'123',ownerId:'456'})} as unknown as Collection,{findOne:async()=>({})} as unknown as Collection,workers);
 const token='x'.repeat(43),b=await registry.claim(token,'w1');await registry.heartbeat(b,true,token);await registry.finish(b,true,token);
 for(const [i,type] of ['worker_claimed','worker_heartbeat','worker_stopped'].entries()){
  assert.deepEqual(calls[i]!.f['ownershipOutbox.99'],{$exists:false});assert.ok(JSON.stringify(calls[i]!.u).includes(type));
 }
});
