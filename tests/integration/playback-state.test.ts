import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { MongoQueue } from '../../packages/database/queues.js';
import { AssistantLeases, type AssistantRecord } from '../../packages/database/leases.js';
import type { QueueState } from '../../packages/queue/state.js';

test('real MongoDB queue CAS, concurrent skip, and restart metadata recovery', {skip:!process.env.TEST_MONGODB_URI},async()=>{
 const client=await new MongoClient(process.env.TEST_MONGODB_URI!,{serverSelectionTimeoutMS:3000}).connect();
 const db=client.db('music_test_'+randomUUID().replaceAll('-',''));
 try {
  const repo=new MongoQueue(db.collection<QueueState>('music_queues'),'123','-1001');await repo.ensureIndexes();await repo.initialize();
  let s=await repo.apply(0,{type:'enqueue',track:{id:'a',mediaHandle:'a',title:'A'}});
  s=await repo.apply(s.revision,{type:'enqueue',track:{id:'b',mediaHandle:'b',title:'B'}});
  const source={sessionId:'s',generation:1,requestId:'r'};
  s=await repo.apply(s.revision,{type:'begin',source});s=await repo.apply(s.revision,{type:'confirmed',source});
  const results=await Promise.allSettled([repo.apply(s.revision,{type:'skip'}),repo.apply(s.revision,{type:'skip'})]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal((await repo.read()).current?.track.id,'b');
  s=await repo.read();await repo.apply(s.revision,{type:'enqueue',track:{id:'c',mediaHandle:'c',title:'C'}});
  const restarted=new MongoQueue(db.collection<QueueState>('music_queues'),'123','-1001');
  s=await restarted.read();s=await restarted.apply(s.revision,{type:'recover'});
  assert.equal(s.current,null);assert.equal(s.savedUpcoming[0]?.id,'c');assert.equal(s.intent,null);
 } finally {await db.dropDatabase();await client.close();}
});
test('real MongoDB terminal receipt survives reconstruction and concurrent duplicate completion', {skip:!process.env.TEST_MONGODB_URI},async()=>{
 const client=await new MongoClient(process.env.TEST_MONGODB_URI!,{serverSelectionTimeoutMS:3000}).connect();
 const db=client.db('music_test_'+randomUUID().replaceAll('-',''));
 try{
  const collection=db.collection<QueueState>('music_queues');
  const repo=new MongoQueue(collection,'123','-1001');await repo.ensureIndexes();await repo.initialize();
  let s=await repo.read();
  for(const id of ['a','b'])s=await repo.apply(s.revision,{type:'enqueue',track:{id,title:id,mediaHandle:id}});
  const source={sessionId:'s',generation:1,requestId:'r'};
  s=await repo.apply(s.revision,{type:'begin',source});s=await repo.apply(s.revision,{type:'confirmed',source});
  const results=await Promise.allSettled([repo.apply(s.revision,{type:'ended',source}),repo.apply(s.revision,{type:'ended',source})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const restarted=new MongoQueue(collection,'123','-1001');const persisted=await restarted.read();
  assert.equal(persisted.current?.track.id,'b');
  assert.deepEqual(persisted.terminalReceipts,[{type:'ended',source,trackId:'a',revision:s.revision+1}]);
  const recovered=await restarted.apply(persisted.revision,{type:'recover'});
  assert.deepEqual(recovered.terminalReceipts,persisted.terminalReceipts);
  assert.equal(await collection.countDocuments({botId:'456'}),0);
 }finally{await db.dropDatabase();await client.close();}
});
test('real MongoDB assistant acquire/renew/expiry cannot be stolen without cleanup', {skip:!process.env.TEST_MONGODB_URI},async()=>{
 const client=await new MongoClient(process.env.TEST_MONGODB_URI!,{serverSelectionTimeoutMS:3000}).connect();
 const db=client.db('music_test_'+randomUUID().replaceAll('-',''));
 try {
  const collection=db.collection<AssistantRecord>('assistants');const repo=new AssistantLeases(collection);await repo.ensureIndexes();
  await collection.insertOne({assistantId:'a',enabled:true,secretRef:'operator-secret',state:'idle',generation:0});
  const acquired=await repo.acquire('a','w1','123','-1001',30000);assert.equal(acquired.generation,1);
  await assert.rejects(repo.acquire('a','w2','456','-2001',30000),/ASSISTANT_BUSY/);
  await assert.rejects(repo.renew('a','w2',1,30000),/LEASE_LOST/);
  await repo.renew('a','w1',1,30000);
  await collection.updateOne({assistantId:'a'},{$set:{expiresAt:new Date(0)}});
  await assert.rejects(repo.renew('a','w1',1,30000),/LEASE_LOST/);
  await assert.rejects(repo.acquire('a','w2','456','-2001',30000),/ASSISTANT_BUSY/);
  await repo.releaseAfterCleanup('a','w1',1);
  const next=await repo.acquire('a','w2','456','-2001',30000);assert.equal(next.generation,2);
  await assert.rejects(repo.releaseAfterCleanup('a','w1',1),/LEASE_LOST/);
 } finally {await db.dropDatabase();await client.close();}
});
