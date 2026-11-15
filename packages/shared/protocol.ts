import { TextDecoder } from 'node:util';
export const MAX_FRAME_BYTES = 65536;
const operations = ['health', 'prepare/join', 'start-local-media', 'pause', 'resume', 'switch-local-media', 'stop', 'leave', 'reconcile', 'renew'] as const;
export interface VoiceRequest {
  protocolVersion: 1; requestId: string; botId: string; chatId: string; sessionId: string;
  assistantLeaseGeneration: number; expectedRevision: number;
  operation: typeof operations[number]; payload: { mediaHandle?: string; leaseMs?: number };
}
export function validateRequest(value: unknown): VoiceRequest {
  const invalid = () => { throw new Error('REQUEST_INVALID'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const r = value as Record<string, unknown>;
  const keys = ['protocolVersion', 'requestId', 'botId', 'chatId', 'sessionId', 'assistantLeaseGeneration', 'expectedRevision', 'operation', 'payload'];
  if (Object.keys(r).length !== keys.length || keys.some(k => !(k in r))) return invalid();
  const id = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
  if (r.protocolVersion !== 1 || !id(r.requestId) || !id(r.sessionId) || typeof r.botId !== 'string' || !/^[1-9]\d{0,19}$/.test(r.botId) || typeof r.chatId !== 'string' || !/^-?[1-9]\d{0,19}$/.test(r.chatId)) return invalid();
  if (!Number.isSafeInteger(r.assistantLeaseGeneration) || (r.assistantLeaseGeneration as number) < 1 || !Number.isSafeInteger(r.expectedRevision) || (r.expectedRevision as number) < 0 || !operations.includes(r.operation as VoiceRequest['operation'])) return invalid();
  if (!r.payload || typeof r.payload !== 'object' || Array.isArray(r.payload)) return invalid();
  const p = r.payload as Record<string, unknown>;
  if (r.operation === 'start-local-media' || r.operation === 'switch-local-media') {
    if (Object.keys(p).length !== 1 || !id(p.mediaHandle)) return invalid();
  } else if (r.operation === 'renew') {
    if (Object.keys(p).length !== 1 || !Number.isSafeInteger(p.leaseMs) || (p.leaseMs as number) < 100 || (p.leaseMs as number) > 60000) return invalid();
  } else if (Object.keys(p).length) return invalid();
  return value as VoiceRequest;
}
export function encodeFrame(value: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(value));
  if (body.length === 0 || body.length > MAX_FRAME_BYTES) throw new Error('FRAME_INVALID');
  const header = Buffer.alloc(4); header.writeUInt32BE(body.length);
  return Buffer.concat([header, body]);
}
/** Four-byte big-endian length + UTF-8 JSON. Never buffers an unbounded body. */
export class FrameDecoder {
  private header = Buffer.alloc(0);
  private body = Buffer.alloc(0);
  private length = 0;
  private failed = false;
  push(chunk: Buffer): unknown[] {
    if (this.failed) throw new Error('FRAME_INVALID');
    const results: unknown[] = [];
    try {
      while (chunk.length) {
        if (!this.length) {
          const take = Math.min(4 - this.header.length, chunk.length);
          this.header = Buffer.concat([this.header, chunk.subarray(0, take)]);
          chunk = chunk.subarray(take);
          if (this.header.length !== 4) continue;
          this.length = this.header.readUInt32BE(); this.header = Buffer.alloc(0);
          if (!this.length || this.length > MAX_FRAME_BYTES) throw new Error();
        }
        const take = Math.min(this.length - this.body.length, chunk.length);
        this.body = Buffer.concat([this.body, chunk.subarray(0, take)]); chunk = chunk.subarray(take);
        if (this.body.length === this.length) {
          results.push(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(this.body)));
          this.body = Buffer.alloc(0); this.length = 0;
        }
      }
      return results;
    } catch { this.failed = true; throw new Error('FRAME_INVALID'); }
  }
  finish(): void { if (this.failed || this.header.length || this.length) throw new Error('FRAME_INVALID'); }
}
