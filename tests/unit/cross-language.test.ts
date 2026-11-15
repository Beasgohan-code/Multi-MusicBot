import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { encodeFrame, FrameDecoder } from '../../packages/shared/protocol.js';
test('TypeScript and Python share framing and strict request validation (not a voice simulation)', () => {
  const request = { protocolVersion: 1, requestId: 'cross', botId: '123', chatId: '-100123', sessionId: 's1', assistantLeaseGeneration: 1, expectedRevision: 0, operation: 'start-local-media', payload: { mediaHandle: 'fixture-a' } };
  const source = `import sys\nsys.path.insert(0,'apps/voice-engine')\nfrom protocol import read_frame,write_frame,validate_request\nr=validate_request(read_frame(sys.stdin.buffer))\nwrite_frame(sys.stdout.buffer,r)\n`;
  const result = spawnSync('python3', ['-c', source], { input: encodeFrame(request), timeout: 3000 });
  assert.equal(result.status, 0, result.stderr.toString());
  const decoder = new FrameDecoder();
  assert.deepEqual(decoder.push(result.stdout), [request]); decoder.finish();
});
