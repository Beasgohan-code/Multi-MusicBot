import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SecretVault } from '../../packages/security/vault.js';
import { loadConfig } from '../../packages/config/index.js';

const key = Buffer.alloc(32, 7);
test('vault uses fresh nonces and tenant/purpose authenticated encryption', () => {
  const vault = new SecretVault({ v1: key }, 'v1');
  const context = { botId: '123', purpose: 'bot-token' };
  const a = vault.encrypt('sensitive-token', context);
  const b = vault.encrypt('sensitive-token', context);
  assert.notEqual(a.nonce, b.nonce);
  assert.equal(vault.decrypt(a, context), 'sensitive-token');
  assert.throws(() => vault.decrypt(a, { ...context, botId: '456' }), /SECRET_INVALID/);
  assert.throws(() => vault.decrypt(a, { ...context, purpose: 'assistant-session' }), /SECRET_INVALID/);
  assert.throws(() => vault.decrypt({ ...a, tag: Buffer.alloc(16).toString('base64') }, context), /SECRET_INVALID/);
  assert.ok(!JSON.stringify(a).includes('sensitive-token'));
});
test('vault supports old keys during rotation and rejects malformed envelopes', () => {
  const old = new SecretVault({ old: key }, 'old');
  const context = { botId: '123', purpose: 'bot-token' };
  const envelope = old.encrypt('token', context);
  const rotated = new SecretVault({ old: key, new: Buffer.alloc(32, 9) }, 'new');
  assert.equal(rotated.decrypt(envelope, context), 'token');
  assert.equal(rotated.encrypt('token', context).keyVersion, 'new');
  assert.throws(() => rotated.decrypt({ ...envelope, ciphertext: '!!!' }, context), /SECRET_INVALID/);
  assert.throws(() => new SecretVault({ bad: Buffer.alloc(8) }, 'bad'), /KEY_INVALID/);
});
const env = () => ({ BOT_TOKEN: '123456:abcdefghijklmnopqrstuvwxyzABCDEFG', OWNER_ID: '123', MONGODB_URI: 'mongodb://localhost:27017', MONGODB_DB: 'music_test', ENCRYPTION_KEY: key.toString('base64') });
test('config parses bounded limits and never includes submitted secrets in errors', () => {
  assert.equal(loadConfig(env()).maxActiveCalls, 1);
  assert.equal(loadConfig(env()).mongodbDb, 'music_test');
  for (const patch of [{ MAX_ACTIVE_CALLS: '2' }, { MAX_QUEUE: '0' }, { OWNER_ID: '1e3' }, { ENCRYPTION_KEY: 'secret-bad-value' }, { MONGODB_URI: 'https://secret-host' }]) {
    assert.throws(() => loadConfig({ ...env(), ...patch }), error => error instanceof Error && !error.message.includes('secret-'));
  }
});
