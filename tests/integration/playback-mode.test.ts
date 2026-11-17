import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MongoClient} from 'mongodb';
import {PlaybackPreferences,requireVoiceMode} from '../../packages/database/playback-preferences.js';
test('real Mongo owner-scoped playback preference CAS, reconstruction, suspension and VC guard',{skip:!process.env.TEST_MONGODB_URI},async()=>{
 const client=await new MongoClient(process.env.TEST_MONGODB_URI!,{serverSelectionTimeoutMS:3000}).connect();
 const db=client.db('music_test_'+randomUUID().replaceAll('-',''));
 try{
  const bots=db.collection('bots');await bots.createIndex({botId:1},{unique:true});
  await bots.insertMany([{botId:'123',ownerId:'456'},{botId:'789',ownerId:'999'}]);
  const repo=new PlaybackPreferences(bots);
  await assert.rejects(repo.request('123','999',0,'webapp'),/UNAUTHORIZED/);
  const writes=await Promise.allSettled([repo.request('123','456',0,'webapp'),repo.request('123','456',0,'webapp')]);
  assert.equal(writes.filter(r=>r.status==='fulfilled').length,1);
  const stored=await new PlaybackPreferences(bots).read('123','456');
  assert.deepEqual(stored,{mode:'webapp',revision:1,status:'unapplied'});assert.throws(()=>requireVoiceMode(stored),/WEBAPP_PLAYBACK_NOT_AVAILABLE/);
  assert.deepEqual(await repo.read('789','999'),{mode:'vc',revision:0,status:'unapplied'});
  const vc=await repo.request('123','456',1,'vc');assert.doesNotThrow(()=>requireVoiceMode(vc));
  await bots.updateOne({botId:'123'},{$set:{suspended:true}});
  await assert.rejects(repo.request('123','456',2,'webapp'),/UNAUTHORIZED/);
 }finally{await db.dropDatabase();await client.close();}
});
