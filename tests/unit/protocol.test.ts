import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FrameDecoder, encodeFrame, validateRequest } from '../../packages/shared/protocol.js';
const request = { protocolVersion: 1, requestId: 'r1', botId: '123', chatId: '-100123', sessionId: 's1', assistantLeaseGeneration: 1, expectedRevision: 0, operation: 'pause', payload: {} };
test('frames tolerate split UTF8 and multiple messages', () => {
  const frame = encodeFrame({ value: 'മലയാളം' });
  const decoder = new FrameDecoder();
  assert.deepEqual(decoder.push(frame.subarray(0, 7)), []);
  assert.deepEqual(decoder.push(Buffer.concat([frame.subarray(7), encodeFrame(request)])), [{ value: 'മലയാളം' }, request]);
  decoder.finish();
});
test('reject oversize length before buffering payload, malformed JSON and truncated stream', () => {
  const header = Buffer.alloc(4); header.writeUInt32BE(65537);
  assert.throws(() => new FrameDecoder().push(header), /FRAME_INVALID/);
  assert.throws(() => encodeFrame({ data: 'x'.repeat(65536) }), /FRAME_INVALID/);
  const d = new FrameDecoder(); d.push(Buffer.from([0, 0]));
  assert.throws(() => d.finish(), /FRAME_INVALID/);
  const bad = Buffer.from([0, 0, 0, 1, 123]);
  assert.throws(() => new FrameDecoder().push(bad), /FRAME_INVALID/);
});
test('request validation is strict and denies raw paths/URLs and unsupported operations', () => {
  assert.deepEqual(validateRequest(request), request);
  for (const patch of [{ botId: '' }, { protocolVersion: 2 }, { assistantLeaseGeneration: 0 }, { expectedRevision: -1 }, { operation: 'shell' }, { payload: { path: '/etc/passwd' } }, { unexpected: true }]) {
    assert.throws(() => validateRequest({ ...request, ...patch }), /REQUEST_INVALID/);
  }
  assert.throws(() => validateRequest({ ...request, operation: 'start-local-media', payload: { mediaHandle: '../secret' } }), /REQUEST_INVALID/);
  assert.equal(validateRequest({ ...request, operation: 'start-local-media', payload: { mediaHandle: 'fixture-a' } }).operation, 'start-local-media');
});
test('lease renewal requires bounded integer duration and no raw expiry timestamp', () => {
  const r = { protocolVersion:1,requestId:'renew1',botId:'123',chatId:'-1001',sessionId:'s1',assistantLeaseGeneration:1,expectedRevision:1,operation:'renew',payload:{leaseMs:1000} };
  assert.equal(validateRequest(r).operation,'renew');
  for(const payload of [{leaseMs:0},{leaseMs:60001},{leaseMs:100.5},{expiresAt:'tomorrow'}])assert.throws(()=>validateRequest({...r,payload}),/REQUEST_INVALID/);
});
