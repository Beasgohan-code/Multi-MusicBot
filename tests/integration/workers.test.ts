import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {MongoClient} from 'mongodb';
import {WorkerRegistry} from '../../packages/database/workers.js';

test('real Mongo worker registration: concurrent claim, revocation, fencing and quarantine',{skip:!process.env.TEST_MONGODB_URI},async()=>{
 const client=await new MongoClient(process.env.TEST_MONGODB_URI!,{serverSelectionTimeoutMS:3000}).connect();
 const db=client.db('music_test_'+randomUUID().replaceAll('-',''));
 try{
  const grants=db.collection('worker_grants'),bots=db.collection('bots'),workers=db.collection('workers');
  const registry=new WorkerRegistry(grants,bots,workers);await registry.ensureIndexes();
  const token='x'.repeat(43),tokenHash=createHash('sha256').update(token).digest('hex');
  const scope={botId:'123',ownerId:'456'};
  await grants.insertOne({...scope,tokenHash,enabled:true});
  await bots.insertOne({...scope,suspended:false});
  await workers.insertOne({...scope,state:'stopped',generation:0});
  const claims=await Promise.allSettled([registry.claim(token,'w1'),registry.claim(token,'w2')]);
  const winners=claims.filter(r=>r.status==='fulfilled');assert.equal(winners.length,1);
  const binding=winners[0]!.value;
  await registry.heartbeat(binding,true,token);
  await assert.rejects(registry.finish(binding,true,'y'.repeat(43)),/WORKER_OWNERSHIP_LOST/);
  await assert.rejects(registry.heartbeat({...binding,generation:2},true,token),/WORKER_OWNERSHIP_LOST/);
  await grants.updateOne({tokenHash},{$set:{enabled:false}});
  const before=await workers.findOne(scope);
  await assert.rejects(registry.heartbeat(binding,true,token),/WORKER_UNAUTHORIZED/);
  assert.deepEqual((await workers.findOne(scope))?.expiresAt,before?.expiresAt);
  // Revocation does not prevent the actual holder from recording uncertain cleanup.
  await registry.finish(binding,false,token);
  await grants.updateOne({tokenHash},{$set:{enabled:true}});
  await assert.rejects(registry.claim(token,'w3'),/WORKER_BUSY_OR_QUARANTINED/);
  assert.equal((await workers.findOne(scope))?.state,'quarantined');
 }finally{await db.dropDatabase();await client.close();}
});

test('real Mongo abandoned ownership quarantine is fenced, durable and never allows takeover',{skip:!process.env.TEST_MONGODB_URI},async()=>{
 const {AbandonedOwnership}=await import('../../packages/database/reconciliation.js');
 const {AssistantLeases}=await import('../../packages/database/leases.js');
 const client=await new MongoClient(process.env.TEST_MONGODB_URI!,{serverSelectionTimeoutMS:3000}).connect();
 const db=client.db('music_test_'+randomUUID().replaceAll('-',''));
 try{
  const workers=db.collection('workers'),assistants=db.collection('assistants');
  const repo=new AbandonedOwnership(workers,assistants);
  const w={botId:'123',ownerId:'456',workerId:'w1',generation:1};
  const a={assistantId:'a',holderId:'w1',botId:'123',chatId:'-1001',generation:1};
  await workers.insertOne({...w,state:'ready',expiresAt:new Date(0)});
  await assistants.insertOne({...a,state:'leased',enabled:true,secretRef:'operator-only',expiresAt:new Date(Date.now()+60000)});
  assert.equal(await repo.assistant(a),false);
  assert.equal(await repo.worker({...w,generation:2}),false);
  assert.equal(await repo.worker(w),true);assert.equal(await repo.worker(w),false);
  await assistants.updateOne({assistantId:'a'},{$set:{expiresAt:new Date(0)}});
  const results=await Promise.all([repo.assistant(a),repo.assistant(a)]);
  assert.equal(results.filter(Boolean).length,1);
  const record=await assistants.findOne({assistantId:'a'});
  assert.equal(record?.state,'leased');assert.equal(record?.cleanupStatus,'quarantined');
  assert.equal(record?.ownershipOutbox.length,1);
  assert.equal(record?.ownershipOutbox[0].type,'assistant_abandoned');
  assert.ok(!JSON.stringify(record?.ownershipOutbox).includes('operator-only'));
  const leases=new AssistantLeases(db.collection('assistants'));
  await assert.rejects(leases.acquire('a','w2','789','-2001',30000),/ASSISTANT_BUSY/);
 }finally{await db.dropDatabase();await client.close();}
});

test('real Mongo ownership audit survives release and relay replay',{skip:!process.env.TEST_MONGODB_URI},async()=>{
 const {OwnershipOutbox}=await import('../../packages/database/ownership-outbox.js');
 const {AssistantLeases}=await import('../../packages/database/leases.js');
 const client=await new MongoClient(process.env.TEST_MONGODB_URI!,{serverSelectionTimeoutMS:3000}).connect();
 const db=client.db('music_test_'+randomUUID().replaceAll('-',''));
 try{
  const source=db.collection('assistants'),archive=db.collection('ownership_events');
  const leases=new AssistantLeases(db.collection('assistants'));await leases.ensureIndexes();
  await source.insertOne({assistantId:'a',enabled:true,secretRef:'not-audit-data',state:'idle',generation:0});
  await leases.acquire('a','w1','123','-1001',30000);await leases.renew('a','w1',1,30000);await leases.releaseAfterCleanup('a','w1',1);
  const pending=await source.findOne({assistantId:'a'});assert.equal(pending?.botId,undefined);assert.equal(pending?.ownershipOutbox.length,3);
  const relay=new OwnershipOutbox(archive);await relay.ensureIndexes();
  // Simulate a relay crash after archive but before acknowledgement.
  await archive.insertOne(pending!.ownershipOutbox[0]);
  assert.equal(await relay.flush(source,{botId:'123'}),3);assert.equal(await relay.flush(source,{botId:'123'}),0);
  assert.equal(await archive.countDocuments({botId:'123'}),3);
  assert.ok(!JSON.stringify(await archive.find({}).toArray()).includes('not-audit-data'));
  assert.equal((await source.findOne({assistantId:'a'}))?.ownershipOutbox.length,0);
 }finally{await db.dropDatabase();await client.close();}
});
