import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Collection } from 'mongodb';
import { AssistantLeases, type AssistantRecord } from '../../packages/database/leases.js';
test('lease operations use holder/generation guards and server-time expiry; acquire never steals expired sessions', async () => {
  const calls: {filter: unknown; update: unknown}[] = [];
  const collection = {async findOneAndUpdate(filter: unknown, update: unknown) { calls.push({filter,update}); return null; }} as unknown as Collection<AssistantRecord>;
  const repo = new AssistantLeases(collection);
  await assert.rejects(repo.acquire('slot1', 'worker1', '123', '-1001', 30000), /ASSISTANT_BUSY/);
  const f = calls[0]!.filter as Record<string,unknown>;
  assert.equal(f.state, 'idle'); assert.equal(f.enabled, true);
  assert.ok(!JSON.stringify(f).includes('expiresAt')); // expiry is NOT permission to seize native ownership
  await assert.rejects(repo.renew('slot1', 'worker1', 1, 30000), /LEASE_LOST/);
  assert.ok(JSON.stringify(calls[1]!.filter).includes('$$NOW'));
  assert.ok(JSON.stringify(calls[1]!.update).includes('$$NOW'));
  await assert.rejects(repo.releaseAfterCleanup('slot1', 'worker1', 1), /LEASE_LOST/);
  assert.deepEqual(calls[2]!.filter, {'ownershipOutbox.99':{$exists:false},assistantId:'slot1',state:'leased',holderId:'worker1',generation:1});
});
test('lease validation rejects missing holder, unsafe duration and invalid tenant before DB access', async () => {
  const repo = new AssistantLeases({} as Collection<AssistantRecord>);
  await assert.rejects(repo.acquire('slot1', '', '123', '-1001', 30000), /LEASE_INVALID/);
  await assert.rejects(repo.acquire('slot1', 'worker1', '123', '-1001', 0), /LEASE_INVALID/);
  await assert.rejects(repo.acquire('slot1', 'worker1', '', '-1001', 30000), /LEASE_INVALID/);
});
