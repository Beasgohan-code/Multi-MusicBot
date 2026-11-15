import type { Collection } from 'mongodb';
import { SecretVault, type Envelope } from '../security/vault.js';
export interface SecretDocument { botId: string; ownerId: string; envelope: Envelope; updatedAt: Date }
/** Runtime-only repository. Callers must supply the authenticated owner, not a submitted owner ID. */
export class BotSecrets {
  constructor(private readonly collection: Collection<SecretDocument>, private readonly vault: SecretVault) {}
  async ensureIndexes(): Promise<void> {
    await this.collection.createIndex({ botId: 1 }, { unique: true, name: 'unique_bot_secret' });
    await this.collection.createIndex({ ownerId: 1, botId: 1 }, { name: 'owner_bot_secret' });
  }
  private scope(botId: string, ownerId: string) {
    if (!/^[1-9]\d{0,19}$/.test(botId) || !/^[1-9]\d{0,19}$/.test(ownerId)) throw new Error('IDENTITY_INVALID');
    return { botId, ownerId };
  }
  private document(botId: string, ownerId: string, secret: string): SecretDocument {
    const scope = this.scope(botId, ownerId);
    if (!secret || secret.length > 4096) throw new Error('SECRET_INVALID');
    return { ...scope, envelope: this.vault.encrypt(secret, { botId, purpose: 'bot-token' }), updatedAt: new Date() };
  }
  async create(botId: string, ownerId: string, secret: string): Promise<void> {
    await this.collection.insertOne(this.document(botId, ownerId, secret));
  }
  async rotate(botId: string, ownerId: string, secret: string): Promise<void> {
    const document = this.document(botId, ownerId, secret);
    const result = await this.collection.updateOne(this.scope(botId, ownerId), { $set: document });
    if (result.matchedCount !== 1) throw new Error('SECRET_NOT_FOUND');
  }
  async read(botId: string, ownerId: string): Promise<string> {
    const document = await this.collection.findOne(this.scope(botId, ownerId));
    if (!document) throw new Error('SECRET_NOT_FOUND');
    return this.vault.decrypt(document.envelope, { botId, purpose: 'bot-token' });
  }
  async remove(botId: string, ownerId: string): Promise<void> {
    await this.collection.deleteOne(this.scope(botId, ownerId));
  }
}
