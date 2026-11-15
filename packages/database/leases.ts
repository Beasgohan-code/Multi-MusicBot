import {ownershipCapacity,ownershipEvent} from './ownership-events.js';
import type { Collection } from 'mongodb';
export interface AssistantRecord {
  assistantId: string; enabled: boolean; secretRef: string; state: 'idle' | 'leased'; generation: number;
  holderId?: string; botId?: string; chatId?: string; expiresAt?: Date; updatedAt?: Date;
}
/** Operator/runtime-only. Never expose secretRef or accept ownership from a tenant request. */
export class AssistantLeases {
  constructor(private readonly collection: Collection<AssistantRecord>) {}
  private validate(assistantId: string, holderId: string, generation?: number, ttlMs?: number): void {
    if (![assistantId,holderId].every(x => typeof x === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(x)) || generation !== undefined && (!Number.isSafeInteger(generation) || generation < 1) || ttlMs !== undefined && (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 60000)) throw new Error('LEASE_INVALID');
  }
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ assistantId: 1 }, { unique: true });
    await this.collection.createIndex({ chatId: 1 }, { unique: true, partialFilterExpression: { state: 'leased' } });
  }
  async acquire(assistantId: string, holderId: string, botId: string, chatId: string, ttlMs: number): Promise<AssistantRecord> {
    this.validate(assistantId,holderId,undefined,ttlMs);
    if (!/^[1-9]\d{0,19}$/.test(botId) || !/^-[1-9]\d{0,19}$/.test(chatId)) throw new Error('LEASE_INVALID');
    // Only an explicitly idle, cleaned slot is eligible. Expiry never means native teardown.
    const record = await this.collection.findOneAndUpdate({ ...ownershipCapacity, assistantId, enabled: true, state: 'idle', generation: { $lt: Number.MAX_SAFE_INTEGER } }, [{ $set: { state: 'leased', holderId: { $literal: holderId }, botId, chatId, generation: { $add: ['$generation', 1] }, expiresAt: { $add: ['$$NOW', ttlMs] }, updatedAt: '$$NOW' } },ownershipEvent('assistant_acquired')], { returnDocument: 'after' });
    if (!record) throw new Error('ASSISTANT_BUSY');
    return record;
  }
  async renew(assistantId: string, holderId: string, generation: number, ttlMs: number): Promise<AssistantRecord> {
    this.validate(assistantId,holderId,generation,ttlMs);
    const record = await this.collection.findOneAndUpdate({ ...ownershipCapacity, assistantId, holderId, generation, enabled: true, state: 'leased', $expr: { $gt: ['$expiresAt', '$$NOW'] } }, [{ $set: { expiresAt: { $add: ['$$NOW',ttlMs] }, updatedAt: '$$NOW' } },ownershipEvent('assistant_renewed')], { returnDocument: 'after' });
    if (!record) throw new Error('LEASE_LOST');
    return record;
  }
  /** Invoke only after the trusted supervisor has reaped the holder's native process group. */
  async releaseAfterCleanup(assistantId: string, holderId: string, generation: number): Promise<void> {
    this.validate(assistantId,holderId,generation);
    const record = await this.collection.findOneAndUpdate({...ownershipCapacity,assistantId,state:'leased',holderId,generation}, [ownershipEvent('assistant_released'),{$set:{state:'idle',updatedAt:'$$NOW'}},{$unset:['holderId','botId','chatId','expiresAt','cleanupStatus','quarantinedAt']}]);
    if (!record) throw new Error('LEASE_LOST');
  }
}
