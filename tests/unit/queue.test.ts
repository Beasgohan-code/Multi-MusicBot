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
