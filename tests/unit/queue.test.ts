import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyQueue, transition } from '../../packages/queue/state.js';
const a = { id: 'a', mediaHandle: 'fixture-a', title: 'A' };
const b = { id: 'b', mediaHandle: 'fixture-b', title: 'B' };
const source = { sessionId: 's1', generation: 1, requestId: 'play-a' };
function playing() {
  let s = transition(emptyQueue('123', '-1001'), { type: 'enqueue', track: a });
  s = transition(s, { type: 'enqueue', track: b });
  s = transition(s, { type: 'begin', source });
  return transition(s, { type: 'confirmed', source });
}
test('confirmed end advances one item and rejects duplicate source events', () => {
  const s = playing();
  const next = transition(s, { type: 'ended', source });
  assert.equal(next.revision, s.revision + 1);
  assert.equal(next.current?.track.id, 'b');
  assert.equal(next.current?.state, 'preparing');
  assert.equal(next.intent?.type, 'start');
  assert.throws(() => transition(next, { type: 'ended', source }), /SOURCE_STALE/);
});
test('disconnect/recovery preserve upcoming metadata without automatic playback', () => {
  const s = transition(playing(), { type: 'disconnected', source });
  assert.equal(s.current?.state, 'interrupted');
  assert.equal(s.intent, null);
  assert.deepEqual(s.upcoming, [b]);
  const recovered = transition(s, { type: 'recover' });
  assert.equal(recovered.current, null);
  assert.deepEqual(recovered.savedUpcoming, [b]);
  assert.deepEqual(recovered.upcoming, []);
  assert.equal(recovered.intent, null);
});
test('stop invalidates callbacks; enqueue validates bounds and duplicate identities', () => {
  const stopped = transition(playing(), { type: 'stop' });
  assert.equal(stopped.current, null);
  assert.equal(stopped.intent?.type, 'stop');
  assert.throws(() => transition(stopped, { type: 'ended', source }), /SOURCE_STALE/);
  assert.throws(() => transition(playing(), { type: 'enqueue', track: b }), /TRACK_DUPLICATE/);
  assert.throws(() => transition(emptyQueue('123', '-1001'), { type: 'enqueue', track: { ...a, mediaHandle: '../escape' } }), /TRACK_INVALID/);
});
test('control acknowledgements require matching source and pending intent', () => {
  const pausedIntent = transition(playing(), { type: 'pause' });
  assert.equal(pausedIntent.current?.state, 'playing');
  const paused = transition(pausedIntent, { type: 'control-confirmed', source, control: 'pause' });
  assert.equal(paused.current?.state, 'paused');
  assert.equal(paused.intent, null);
  assert.throws(() => transition(paused, { type: 'control-confirmed', source, control: 'resume' }), /STATE_INVALID/);
});

test('terminal receipt is committed with the queue transition and survives recovery/stop',()=>{
 const previous=playing();const next=transition(previous,{type:'ended',source});
 assert.deepEqual(next.terminalReceipts,[{type:'ended',source,trackId:'a',revision:next.revision}]);
 assert.deepEqual(previous.terminalReceipts,[]);
 const recovered=transition(next,{type:'recover'});
 const stopped=transition(recovered,{type:'stop'});
 assert.deepEqual(stopped.terminalReceipts,next.terminalReceipts);
 assert.equal(stopped.current,null);
});
test('disconnect journals interruption without advancement or duplicate receipts',()=>{
 const next=transition(playing(),{type:'disconnected',source});
 assert.deepEqual(next.terminalReceipts,[{type:'disconnected',source,trackId:'a',revision:next.revision}]);
 assert.equal(next.current?.track.id,'a');assert.deepEqual(next.upcoming,[b]);
 assert.throws(()=>transition(next,{type:'disconnected',source}),/STATE_INVALID/);
 assert.equal(next.terminalReceipts?.length,1);
});
test('legacy queue without receipts initializes journal only on new terminal transition',()=>{
 const previous=playing();delete previous.terminalReceipts;
 const next=transition(previous,{type:'ended',source});
 assert.equal(next.terminalReceipts?.length,1);
 assert.equal(previous.terminalReceipts,undefined);
});
test('full receipt journal fails closed without losing evidence or advancing',()=>{
 const previous=playing();
 previous.terminalReceipts=Array.from({length:100},(_,i)=>({type:'ended' as const,source:{...source,requestId:'old_'+i},trackId:'old',revision:i+1}));
 const copy=structuredClone(previous);
 assert.throws(()=>transition(previous,{type:'ended',source}),/TERMINAL_JOURNAL_FULL/);
 assert.throws(()=>transition(previous,{type:'disconnected',source}),/TERMINAL_JOURNAL_FULL/);
 assert.deepEqual(previous,copy);
 assert.equal(transition(previous,{type:'stop'}).terminalReceipts?.length,100);
});
test('terminal journal excludes track titles, media paths and extra source fields',()=>{
 const previous=playing();const untrusted={...source,secret:'must-not-persist'};
 const next=transition(previous,{type:'ended',source:untrusted});
 assert.deepEqual(next.terminalReceipts,[{type:'ended',source,trackId:'a',revision:next.revision}]);
 assert.equal(JSON.stringify(next.terminalReceipts).includes('must-not-persist'),false);
});
test('journal exhaustion prevents new source binding but permits explicit stop',()=>{
 let s=playing();s.terminalReceipts=Array.from({length:100},(_,i)=>({type:'ended' as const,source,trackId:'a',revision:i+1}));
 s=transition(s,{type:'stop'});s=transition(s,{type:'enqueue',track:a});
 assert.throws(()=>transition(s,{type:'begin',source}),/TERMINAL_JOURNAL_FULL/);
 assert.equal(s.current,null);assert.deepEqual(s.upcoming,[a]);
});
test('malformed journal container fails closed before a terminal mutation',()=>{
 const s=playing();Object.assign(s,{terminalReceipts:{}});
 assert.throws(()=>transition(s,{type:'ended',source}),/TERMINAL_JOURNAL_INVALID/);
 assert.equal(s.current?.track.id,'a');
});
