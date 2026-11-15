import type { Collection } from 'mongodb';
import { emptyQueue, transition, type QueueState, type Action } from '../queue/state.js';
/** Internal repository. Scope must be derived from an authenticated runtime, never a submitted owner. */
export class MongoQueue {
  constructor(private readonly collection: Collection<QueueState>, private readonly botId: string, private readonly chatId: string) { emptyQueue(botId, chatId); }
  async ensureIndexes(): Promise<void> { await this.collection.createIndex({ botId: 1, chatId: 1 }, { unique: true }); }
  async initialize(): Promise<void> {
    await this.collection.updateOne({ botId: this.botId, chatId: this.chatId }, { $setOnInsert: emptyQueue(this.botId, this.chatId) }, { upsert: true });
  }
  async read(): Promise<QueueState> {
    const value = await this.collection.findOne({ botId: this.botId, chatId: this.chatId }, { projection: { _id: 0 } });
    if (!value) throw new Error('QUEUE_NOT_FOUND');
    return value;
  }
  async apply(expectedRevision: number, action: Action): Promise<QueueState> {
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error('REVISION_INVALID');
    const previous = await this.read();
    if (previous.revision !== expectedRevision) throw new Error('STALE_REVISION');
    const next = transition(previous, action);
    // Queue mutation and next command intent live in one atomic compare-and-swap document.
    const result = await this.collection.replaceOne({ botId: this.botId, chatId: this.chatId, revision: expectedRevision }, next);
    if (result.matchedCount !== 1) throw new Error('STALE_REVISION');
    return next;
  }
}
