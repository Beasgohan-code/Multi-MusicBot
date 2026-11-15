import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'node:crypto';
import { BotSecrets, type SecretDocument } from '../../packages/database/secrets.js';
import { SecretVault } from '../../packages/security/vault.js';

test('real MongoDB: ciphertext storage, tenant isolation, unique bot identity and rotation', { skip: !process.env.TEST_MONGODB_URI }, async () => {
  const client = new MongoClient(process.env.TEST_MONGODB_URI!, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  const db = client.db(`music_test_${randomUUID().replaceAll('-', '')}`);
  try {
    const collection = db.collection<SecretDocument>('bot_secrets');
    const repo = new BotSecrets(collection, new SecretVault({ v1: Buffer.alloc(32, 5) }, 'v1'));
    await repo.ensureIndexes();
    await repo.create('123', '456', 'first-secret');
    assert.ok(!JSON.stringify(await collection.findOne({ botId: '123' })).includes('first-secret'));
    assert.equal(await repo.read('123', '456'), 'first-secret');
    await assert.rejects(repo.read('123', '999'), /SECRET_NOT_FOUND/);
    await assert.rejects(repo.rotate('123', '999', 'hijacked'), /SECRET_NOT_FOUND/);
    await assert.rejects(repo.create('123', '999', 'duplicate'));
    await repo.rotate('123', '456', 'rotated');
    assert.equal(await repo.read('123', '456'), 'rotated');
    await repo.remove('123', '999');
    assert.equal(await repo.read('123', '456'), 'rotated');
    await repo.remove('123', '456');
    await assert.rejects(repo.read('123', '456'), /SECRET_NOT_FOUND/);
  } finally { await db.dropDatabase(); await client.close(); }
});
