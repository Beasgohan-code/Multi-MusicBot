import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Collection} from 'mongodb';
import {PlaybackPreferences,requireVoiceMode} from '../../packages/database/playback-preferences.js';
function harness(){
 let doc:any={botId:'123',ownerId:'456',suspended:false};let writes=0;
 const collection={
  async findOne(f:any){return f.botId===doc.botId&&f.ownerId===doc.ownerId&&!doc.suspended?structuredClone(doc):null;},
  async updateOne(f:any,u:any){
   assert.equal(f.botId,'123');assert.equal(f.ownerId,'456');assert.deepEqual(f.suspended,{$ne:true});
   if(doc.suspended)return {acknowledged:true,matchedCount:0};
   if(typeof f.playbackPreferenceRevision==='object'){
    assert.deepEqual(f.playbackPreferenceRevision,{$exists:false});assert.deepEqual(f.playbackPreference,{$exists:false});
    if(doc.playbackPreferenceRevision!==undefined||doc.playbackPreference!==undefined)return {acknowledged:true,matchedCount:0};
   }else if(f.playbackPreferenceRevision!==doc.playbackPreferenceRevision)return {acknowledged:true,matchedCount:0};
   Object.assign(doc,u.$set);writes++;return {acknowledged:true,matchedCount:1};
  },
 } as unknown as Collection;
 return {repo:new PlaybackPreferences(collection),doc:()=>doc,writes:()=>writes,suspend:()=>{doc.suspended=true;}};
}
test('existing owner bot defaults to VC with unapplied revision zero',async()=>{
 const h=harness();assert.deepEqual(await h.repo.read('123','456'),{mode:'vc',revision:0,status:'unapplied'});assert.equal(h.writes(),0);
});
test('only current owner can request a mode; suspended/missing/cross-tenant bots fail closed',async()=>{
 const h=harness();await assert.rejects(h.repo.read('123','999'),/PLAYBACK_PREFERENCE_UNAUTHORIZED/);
 await assert.rejects(h.repo.request('999','456',0,'webapp'),/PLAYBACK_PREFERENCE_UNAUTHORIZED/);
 h.suspend();await assert.rejects(h.repo.request('123','456',0,'webapp'),/PLAYBACK_PREFERENCE_UNAUTHORIZED/);assert.equal(h.writes(),0);
});
test('request persists desired mode only, never invents an applied acknowledgement',async()=>{
 const h=harness();assert.deepEqual(await h.repo.request('123','456',0,'webapp'),{mode:'webapp',revision:1,status:'unapplied'});
 assert.equal(h.doc().playbackPreference.mode,'webapp');assert.equal(h.doc().playbackPreference.requestedBy,'456');
 assert.equal(h.doc().playbackPreference.appliedRevision,undefined);
 assert.deepEqual(await h.repo.read('123','456'),{mode:'webapp',revision:1,status:'unapplied'});
});
test('concurrent requests and duplicate stale retries admit one desired revision only',async()=>{
 const h=harness();const result=await Promise.allSettled([h.repo.request('123','456',0,'webapp'),h.repo.request('123','456',0,'vc')]);
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(h.writes(),1);
 await assert.rejects(h.repo.request('123','456',0,'vc'),/PLAYBACK_PREFERENCE_CONFLICT/);
 assert.deepEqual(await h.repo.request('123','456',1,'vc'),{mode:'vc',revision:2,status:'unapplied'});
});
test('invalid identities, modes and revisions are rejected before any persistence',async()=>{
 const h=harness();
 for(const mode of ['both','VC','https://example.com',null,{}])await assert.rejects(h.repo.request('123','456',0,mode as any),/PLAYBACK_PREFERENCE_INVALID/);
 for(const revision of [-1,NaN,0.5,Number.MAX_SAFE_INTEGER])await assert.rejects(h.repo.request('123','456',revision,'vc'),/PLAYBACK_PREFERENCE_INVALID/);
 await assert.rejects(h.repo.read('123',{$ne:null} as any),/PLAYBACK_PREFERENCE_INVALID/);assert.equal(h.writes(),0);
});
test('VC guard allows VC but never silently falls back from WebApp or malformed state',()=>{
 assert.doesNotThrow(()=>requireVoiceMode({mode:'vc',revision:0,status:'unapplied'}));
 assert.throws(()=>requireVoiceMode({mode:'webapp',revision:1,status:'unapplied'}),/WEBAPP_PLAYBACK_NOT_AVAILABLE/);
 assert.throws(()=>requireVoiceMode({mode:'both',revision:1,status:'unapplied'} as any),/PLAYBACK_PREFERENCE_INVALID/);
});
test('database failure and unacknowledged writes never report mode saved',async()=>{
 const broken=new PlaybackPreferences({findOne:async()=>{throw new Error('DB_DOWN');}} as unknown as Collection);
 await assert.rejects(broken.read('123','456'),/DB_DOWN/);
 const h=harness();const repo=new PlaybackPreferences({findOne:async()=>h.doc(),updateOne:async()=>({acknowledged:false,matchedCount:1})} as unknown as Collection);
 await assert.rejects(repo.request('123','456',0,'vc'),/PLAYBACK_PREFERENCE_WRITE_UNCERTAIN/);
});
test('partially written or malformed stored preferences fail closed',async()=>{
 for(const doc of [
  {playbackPreferenceRevision:0},
  {playbackPreference:{mode:'webapp',requestedBy:'456'}},
  {playbackPreferenceRevision:1,playbackPreference:{mode:'both',requestedBy:'456'}},
  {playbackPreferenceRevision:1,playbackPreference:{mode:'vc',requestedBy:{$ne:null}}},
 ]){
  const repo=new PlaybackPreferences({findOne:async()=>doc} as unknown as Collection);
  await assert.rejects(repo.read('123','456'),/PLAYBACK_PREFERENCE_INVALID/);
 }
});
test('suspension or transfer between read and write prevents saving',async()=>{
 let attempted=false;
 const repo=new PlaybackPreferences({
  findOne:async()=>({botId:'123',ownerId:'456'}),
  updateOne:async(filter:any,_update:any,options:any)=>{
   attempted=true;assert.equal(filter.ownerId,'456');assert.deepEqual(filter.suspended,{$ne:true});
   assert.deepEqual(options,{writeConcern:{w:'majority'}});return {acknowledged:true,matchedCount:0};
  },
 } as unknown as Collection);
 await assert.rejects(repo.request('123','456',0,'webapp'),/PLAYBACK_PREFERENCE_CONFLICT/);assert.equal(attempted,true);
});
test('ambiguous network acknowledgement is not automatically retried',async()=>{
 let writes=0;
 const repo=new PlaybackPreferences({findOne:async()=>({botId:'123',ownerId:'456'}),updateOne:async()=>{writes++;throw new Error('NETWORK_UNKNOWN');}} as unknown as Collection);
 await assert.rejects(repo.request('123','456',0,'webapp'),/NETWORK_UNKNOWN/);assert.equal(writes,1);
});
