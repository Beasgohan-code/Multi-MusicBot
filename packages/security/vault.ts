import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
export interface SecretContext { botId: string; purpose: string }
export interface Envelope { algorithm: 'aes-256-gcm'; keyVersion: string; nonce: string; tag: string; ciphertext: string }
function decode(value: string): Buffer {
  if (typeof value !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error('SECRET_INVALID');
  return Buffer.from(value, 'base64');
}
export class SecretVault {
  private readonly keys: Map<string, Buffer>;
  constructor(keys: Record<string, Buffer>, private readonly active: string) {
    if (!keys[active] || Object.values(keys).some(key => key.length !== 32)) throw new Error('KEY_INVALID');
    this.keys = new Map(Object.entries(keys).map(([version, key]) => [version, Buffer.from(key)]));
  }
  private aad(context: SecretContext, version: string): Buffer {
    if (!context.botId || !context.purpose) throw new Error('SECRET_INVALID');
    return Buffer.from(JSON.stringify(['multi-musicbot', version, context.botId, context.purpose]));
  }
  encrypt(secret: string, context: SecretContext): Envelope {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.keys.get(this.active)!, nonce);
    cipher.setAAD(this.aad(context, this.active));
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return { algorithm: 'aes-256-gcm', keyVersion: this.active, nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
  }
  decrypt(envelope: Envelope, context: SecretContext): string {
    try {
      const key = this.keys.get(envelope.keyVersion);
      const nonce = decode(envelope.nonce), tag = decode(envelope.tag);
      if (!key || envelope.algorithm !== 'aes-256-gcm' || nonce.length !== 12 || tag.length !== 16) throw new Error();
      const decipher = createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAAD(this.aad(context, envelope.keyVersion));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(decode(envelope.ciphertext)), decipher.final()]).toString('utf8');
    } catch { throw new Error('SECRET_INVALID'); }
  }
}
