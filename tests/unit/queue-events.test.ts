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
  assert.equal(await applyNativeEvent(repo,event),false);
  assert.equal(s.current?.track.id,'b');
});
