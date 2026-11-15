import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Collection,Document} from 'mongodb';
import {OwnershipOutbox} from '../../packages/database/ownership-outbox.js';
const event={eventId:'event-1',type:'worker_abandoned',botId:'123',ownerId:'456',workerId:'w1',generation:2};
function fixture(fail=false){
 let pending=true;const archived=new Map<string,Document>();const calls:string[]=[];
 const source={findOne:async()=>pending?{botId:'123',ownershipOutbox:[event]}:null,updateOne:async()=>{calls.push('ack');if(fail)throw new Error('ACK_DOWN');pending=false;return {matchedCount:1};}} as unknown as Collection;
 const sink={createIndex:async()=>{},updateOne:async(f:Document,u:Document)=>{calls.push('archive');archived.set(f.eventId,u.$setOnInsert);return {upsertedCount:1};}} as unknown as Collection;
 return {source,sink,calls,archived,get pending(){return pending;}};
}
test('ownership events are archived idempotently before source acknowledgement',async()=>{
 const h=fixture();const relay=new OwnershipOutbox(h.sink);await relay.ensureIndexes();
 assert.equal(await relay.flush(h.source,{botId:'123'},10),1);
 assert.deepEqual(h.calls,['archive','ack']);assert.equal(h.pending,false);assert.equal(h.archived.size,1);
});
test('archive failure never acknowledges the durable source',async()=>{
 const h=fixture();const relay=new OwnershipOutbox({updateOne:async()=>{throw new Error('DB_DOWN');}} as unknown as Collection);
 await assert.rejects(relay.flush(h.source,{botId:'123'},10),/DB_DOWN/);
 assert.equal(h.pending,true);assert.equal(h.calls.includes('ack'),false);
});
test('crash after archive and before ack can replay without duplicate event identity',async()=>{
 const h=fixture(true);const relay=new OwnershipOutbox(h.sink);
 await assert.rejects(relay.flush(h.source,{botId:'123'},10),/ACK_DOWN/);
 await assert.rejects(relay.flush(h.source,{botId:'123'},10),/ACK_DOWN/);
 assert.equal(h.pending,true);assert.equal(h.archived.size,1);
});
test('malformed or cross-tenant events are rejected without acknowledgement',async()=>{
 for(const patch of [{botId:'999'},{type:'token_dump'},{secret:'must-not-be-archived'}]){
  let acked=false;
  const source={findOne:async()=>({ownershipOutbox:[{...event,...patch}]}),updateOne:async()=>{acked=true;}} as unknown as Collection;
  await assert.rejects(new OwnershipOutbox({} as Collection).flush(source,{botId:'123'},10),/OWNERSHIP_EVENT_INVALID/);
  assert.equal(acked,false);
 }
});
