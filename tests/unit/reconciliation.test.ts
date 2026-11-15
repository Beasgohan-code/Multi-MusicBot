import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Collection,Document} from 'mongodb';
import {AbandonedOwnership} from '../../packages/database/reconciliation.js';
const worker={botId:'123',ownerId:'456',workerId:'w1',generation:2};
const assistant={assistantId:'a',holderId:'w1',botId:'123',chatId:'-1001',generation:3};
test('abandoned ownership is quarantined atomically with a bounded durable outbox, never released',async()=>{
 const calls:{filter:Document;update:Document}[]=[];
 const collection={findOneAndUpdate:async(filter:Document,update:Document)=>{calls.push({filter,update});return {};}} as unknown as Collection;
 const repo=new AbandonedOwnership(collection,collection);
 await repo.worker(worker);await repo.assistant(assistant);
 for(const c of calls){
  assert.deepEqual(c.filter.$expr,{$lte:['$expiresAt','$$NOW']});
  assert.deepEqual(c.filter['ownershipOutbox.99'],{$exists:false});
  assert.ok(c.update.$push.ownershipOutbox.eventId);
  assert.ok(c.update.$push.ownershipOutbox.createdAt instanceof Date);
  assert.ok(!JSON.stringify(c).includes('grantHash'));
 }
 assert.equal(calls[0]!.update.$set.state,'quarantined');
 assert.equal(calls[1]!.filter.state,'leased');
 assert.equal(calls[1]!.update.$set.cleanupStatus,'quarantined');
 assert.equal(calls[1]!.update.$set.state,undefined); // preserve active-chat exclusivity
 assert.equal(calls[1]!.filter.holderId,'w1');
});
test('stale observations, unexpired holders and outbox backpressure cannot report success',async()=>{
 const c={findOneAndUpdate:async()=>null} as unknown as Collection;
 const repo=new AbandonedOwnership(c,c);
 assert.equal(await repo.worker(worker),false);assert.equal(await repo.assistant(assistant),false);
 await assert.rejects(repo.worker({...worker,generation:0}),/RECONCILIATION_INVALID/);
 await assert.rejects(repo.assistant({...assistant,chatId:'123'}),/RECONCILIATION_INVALID/);
});
test('reconciliation outage propagates without fabricating cleanup evidence',async()=>{
 const c={findOneAndUpdate:async()=>{throw new Error('DB_DOWN');}} as unknown as Collection;
 const repo=new AbandonedOwnership(c,c);
 await assert.rejects(repo.worker(worker),/DB_DOWN/);await assert.rejects(repo.assistant(assistant),/DB_DOWN/);
});
test('bounded reconciliation scan remains bot-scoped and never claims ownership',async()=>{
 const queries:Document[]=[];let scannedLimit=0;
 const collection={find:(f:Document)=>{queries.push(f);return {limit:(n:number)=>{scannedLimit=n;return {toArray:async()=>[]};}};}} as unknown as Collection;
 const result=await new AbandonedOwnership(collection,collection).scan('123',10);
 assert.equal(scannedLimit,10);assert.equal(queries.length,2);assert.equal(result.quarantined,0);
 for(const query of queries){assert.equal(query.botId,'123');assert.deepEqual(query.expiresAt,{$type:'date'});}
});
