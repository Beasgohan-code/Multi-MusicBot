import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BotSecrets } from '../../packages/database/secrets.js';
import { SecretVault } from '../../packages/security/vault.js';
import type { Collection } from 'mongodb';
import type { SecretDocument } from '../../packages/database/secrets.js';

test('credential repository persists only ciphertext, scopes owner reads, and rotates atomically', async () => {
  let saved: SecretDocument | undefined;
  const filters: unknown[] = [];
  const collection = {
    async updateOne(filter: object, update: { $set: SecretDocument }) { filters.push(filter); saved = update.$set; return { matchedCount: 1 }; },
    async findOne(filter: { botId: string; ownerId: string }) { filters.push(filter); return saved?.botId === filter.botId && saved.ownerId === filter.ownerId ? saved : null; },
    async deleteOne(filter: object) { filters.push(filter); return { deletedCount: 1 }; },
  } as unknown as Collection<SecretDocument>;
  const repo = new BotSecrets(collection, new SecretVault({ v1: Buffer.alloc(32, 8) }, 'v1'));
  await repo.rotate('123', '456', 'a-very-secret-token');
  assert.ok(!JSON.stringify(saved).includes('a-very-secret-token'));
  assert.equal(await repo.read('123', '456'), 'a-very-secret-token');
  await assert.rejects(repo.read('123', '999'), /SECRET_NOT_FOUND/);
  assert.deepEqual(filters[0], { botId: '123', ownerId: '456' });
  await repo.remove('123', '456');
  assert.deepEqual(filters.at(-1), { botId: '123', ownerId: '456' });
});
test('invalid tenant IDs fail before touching database', async () => {
  const repo = new BotSecrets({} as Collection<SecretDocument>, new SecretVault({ v1: Buffer.alloc(32) }, 'v1'));
  await assert.rejects(repo.read('', '456'), /IDENTITY_INVALID/);
  await assert.rejects(repo.rotate('123', '456', ''), /SECRET_INVALID/);
});
test('credential initialization creates unique bot and owner lookup indexes', async () => {
  const indexes: unknown[] = [];
  const collection = { async createIndex(...args: unknown[]) { indexes.push(args); return 'index'; } } as unknown as Collection<SecretDocument>;
  const repo = new BotSecrets(collection, new SecretVault({ v1: Buffer.alloc(32) }, 'v1'));
  await repo.ensureIndexes();
  assert.deepEqual(indexes, [[{ botId: 1 }, { unique: true, name: 'unique_bot_secret' }], [{ ownerId: 1, botId: 1 }, { name: 'owner_bot_secret' }]]);
});
