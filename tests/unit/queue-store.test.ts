import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Collection } from 'mongodb';
import { MongoQueue } from '../../packages/database/queues.js';
import { emptyQueue, type QueueState } from '../../packages/queue/state.js';
test('queue repository CAS rejects a concurrent writer and propagates DB failures', async () => {
  let state = emptyQueue('123', '-1001');
  const collection = {
    async findOne(filter: {botId: string}) { assert.equal(filter.botId, '123'); return structuredClone(state); },
    async replaceOne(filter: {revision: number}, next: QueueState) {
      if (filter.revision !== state.revision) return {matchedCount: 0};
      state = structuredClone(next); return {matchedCount: 1};
    },
  } as unknown as Collection<QueueState>;
  const repo = new MongoQueue(collection, '123', '-1001');
  const results = await Promise.allSettled([repo.apply(0, {type:'enqueue',track:{id:'a',title:'A',mediaHandle:'a'}}), repo.apply(0, {type:'enqueue',track:{id:'b',title:'B',mediaHandle:'b'}})]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(state.upcoming.length, 1);
  const broken = new MongoQueue({findOne: async () => {throw new Error('DATABASE_UNAVAILABLE');}} as unknown as Collection<QueueState>, '123', '-1001');
  await assert.rejects(broken.apply(0, {type:'stop'}), /DATABASE_UNAVAILABLE/);
});
test('terminal receipt and advancement share one scoped CAS and survive lost acknowledgement',async()=>{
 let state=emptyQueue('123','-1001');let loseAck=false;let writes=0;
 const collection={
  async findOne(filter:{botId:string;chatId:string}){assert.deepEqual(filter,{botId:'123',chatId:'-1001'});return structuredClone(state);},
  async replaceOne(filter:{botId:string;chatId:string;revision:number},next:QueueState){
   assert.equal(filter.botId,'123');assert.equal(filter.chatId,'-1001');
   if(filter.revision!==state.revision)return {matchedCount:0};
   state=structuredClone(next);writes++;
   if(loseAck)throw new Error('ACK_LOST');
   return {matchedCount:1};
  },
 } as unknown as Collection<QueueState>;
 const repo=new MongoQueue(collection,'123','-1001');
 for(const id of ['a','b'])await repo.apply(state.revision,{type:'enqueue',track:{id,title:id,mediaHandle:id}});
 const source={sessionId:'s',requestId:'r',generation:1};
 await repo.apply(state.revision,{type:'begin',source});await repo.apply(state.revision,{type:'confirmed',source});
 const revision=state.revision;loseAck=true;
 await assert.rejects(repo.apply(revision,{type:'ended',source}),/ACK_LOST/);
 const restarted=new MongoQueue(collection,'123','-1001');const persisted=await restarted.read();
 assert.equal(persisted.current?.track.id,'b');
 assert.deepEqual(persisted.terminalReceipts,[{type:'ended',source,trackId:'a',revision:revision+1}]);
 await assert.rejects(restarted.apply(revision,{type:'ended',source}),/STALE_REVISION/);
 assert.equal(writes,5);assert.equal((await restarted.read()).terminalReceipts?.length,1);
});
