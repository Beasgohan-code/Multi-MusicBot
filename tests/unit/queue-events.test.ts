import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyNativeEvent } from '../../apps/bot-runtime/queue-events.js';
import { emptyQueue, transition, type QueueState, type Action } from '../../packages/queue/state.js';
const source = {sessionId:'s1',generation:1,requestId:'r1'};
const event = {protocolVersion:1 as const,eventId:'e1',requestId:'r1',sessionId:'s1',leaseGeneration:1,sessionRevision:2,eventType:'media_ended',result:{playbackRequestId:'r1'}};
test('native completion and concurrent skip cannot advance the queue twice', async () => {
  let s = emptyQueue('123','-1001');
  for (const id of ['a','b','c']) s=transition(s,{type:'enqueue',track:{id,title:id,mediaHandle:id}});
  s=transition(s,{type:'begin',source}); s=transition(s,{type:'confirmed',source});
  const repo = {async read(){return structuredClone(s);},async apply(rev:number,a:Action):Promise<QueueState>{if(rev!==s.revision)throw new Error('STALE_REVISION');s=transition(s,a);return s;}};
  const revision=s.revision;
  await Promise.allSettled([applyNativeEvent(repo,event),repo.apply(revision,{type:'skip'})]);
  assert.equal(s.current?.track.id,'b');
  assert.deepEqual(s.upcoming.map(t=>t.id),['c']);
  const receipts=structuredClone(s.terminalReceipts);
  assert.equal(await applyNativeEvent(repo,event),false);
  assert.deepEqual(s.terminalReceipts,receipts);
  assert.ok((s.terminalReceipts?.length??0)<=1);
  assert.equal(s.current?.track.id,'b');
});

test('completion retries an unrelated revision conflict and commits exactly once',async()=>{
 let s=emptyQueue('123','-1001');
 s=transition(s,{type:'enqueue',track:{id:'a',title:'a',mediaHandle:'a'}});
 s=transition(s,{type:'begin',source});s=transition(s,{type:'confirmed',source});
 let attempts=0;
 const repo={async read(){return structuredClone(s);},async apply(rev:number,a:Action){
  attempts++;
  if(attempts===1){s=transition(s,{type:'enqueue',track:{id:'b',title:'b',mediaHandle:'b'}});throw new Error('STALE_REVISION');}
  assert.equal(rev,s.revision);s=transition(s,a);return structuredClone(s);
 }};
 assert.equal(await applyNativeEvent(repo,event),true);
 assert.equal(attempts,2);assert.equal(s.current?.track.id,'b');
 assert.equal(await applyNativeEvent(repo,event),false);assert.equal(attempts,2);
});
test('completion contention fails boundedly without changing source or consuming queue',async()=>{
 let s=emptyQueue('123','-1001');
 for(const id of ['a','b'])s=transition(s,{type:'enqueue',track:{id,title:id,mediaHandle:id}});
 s=transition(s,{type:'begin',source});s=transition(s,{type:'confirmed',source});
 const before=structuredClone(s);let attempts=0;
 const repo={async read(){return structuredClone(s);},async apply(){attempts++;throw new Error('STALE_REVISION');}};
 await assert.rejects(applyNativeEvent(repo,event),/QUEUE_CONTENTION/);
 assert.equal(attempts,3);assert.deepEqual(s,before);
});
