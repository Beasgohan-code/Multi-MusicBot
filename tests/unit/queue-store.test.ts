import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Collection } from 'mongodb';
import { MongoQueue } from '../../packages/database/queues.js';
import { emptyQueue, type QueueState } from '../../packages/queue/state.js';
test('queue repository CAS rejects a concurrent writer and propagates DB failures', async () => {
  let state = emptyQueue('123', '-1001');
  const collection = {
    async findOne(filter: {botId: string}) { assert.equal(filter.botId, '123'); return structuredClone(state); },
    async replaceOne(filter: {revision: number}, next: QueueState) {
      if (filter.revision !== state.revision) return {matchedCount: 0};
      state = structuredClone(next); return {matchedCount: 1};
    },
  } as unknown as Collection<QueueState>;
  const repo = new MongoQueue(collection, '123', '-1001');
  const results = await Promise.allSettled([repo.apply(0, {type:'enqueue',track:{id:'a',title:'A',mediaHandle:'a'}}), repo.apply(0, {type:'enqueue',track:{id:'b',title:'B',mediaHandle:'b'}})]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(state.upcoming.length, 1);
  const broken = new MongoQueue({findOne: async () => {throw new Error('DATABASE_UNAVAILABLE');}} as unknown as Collection<QueueState>, '123', '-1001');
  await assert.rejects(broken.apply(0, {type:'stop'}), /DATABASE_UNAVAILABLE/);
});
