import {waitForProcessGroupExit} from './process-group.js';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { FrameDecoder, encodeFrame, validateRequest, type VoiceRequest } from '../../packages/shared/protocol.js';
export interface VoiceEvent { protocolVersion: 1; eventId: string; requestId: string; sessionId: string; leaseGeneration: number; sessionRevision: number; eventType: string; result: Record<string, unknown> }
/** Private single-flight child transport. No retry of ambiguous native side effects. */
export class VoiceProcess extends EventEmitter {
  private binding: VoiceRequest | undefined;
  private terminalSeen = false;
  private playbackRequestId: string | undefined;
  private observedRevision = 0;
  private readonly child: ChildProcessWithoutNullStreams;
  private pending: { request: VoiceRequest; resolve: (v: VoiceEvent) => void; reject: (e: Error) => void; timer: NodeJS.Timeout } | undefined;
  private closed = false;
  private shuttingDown = false;
  private signalUncertain = false;
  private groupGone = false;
  private intentional = false;
  private readonly exited: Promise<void>;
  private shutdownWork: Promise<{clean:boolean}> | undefined;
  private closeWork: Promise<void> | undefined;
  constructor(command: string, args: string[], secrets: Record<string, string>, private readonly timeoutMs = 15000) {
    super();
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error('VOICE_CONFIG_INVALID');
    const allowed = /^(API_ID|API_HASH|ASSISTANT_SESSION|VOICE_[A-Z_]+)$/;
    if (Object.keys(secrets).some(k => !allowed.test(k))) throw new Error('VOICE_CONFIG_INVALID');
    this.child = spawn(command, args, { env: { PATH: process.env.PATH, LANG: 'C.UTF-8', ...secrets }, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    // Never forward raw native logs, which can contain account/session details.
    this.child.stderr.resume();
    const decoder = new FrameDecoder();
    this.child.stdout.on('data', (chunk: Buffer) => {
      try {
        for (const raw of decoder.push(chunk)) this.receive(raw);
      } catch { this.fail('VOICE_PROTOCOL_INVALID'); }
    });
    this.child.stdin.on('error', () => this.fail('VOICE_EXITED'));
    this.exited = new Promise(resolve => {
      this.child.once('error', () => { this.fail('VOICE_EXITED'); resolve(); });
      this.child.once('close', () => { this.fail('VOICE_EXITED'); resolve(); });
    });
  }
  private receive(raw: unknown): void {
    const p = this.pending;
    if (!raw || typeof raw !== 'object') throw new Error();
    const e = raw as VoiceEvent;
    if (['media_ended', 'disconnected'].includes(e.eventType)) {
      const b = this.binding;
      if (!b || e.protocolVersion !== 1 || typeof e.eventId !== 'string' || typeof e.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(e.eventId) || !/^[A-Za-z0-9_-]{1,128}$/.test(e.requestId) || e.sessionId !== b.sessionId || e.leaseGeneration !== b.assistantLeaseGeneration || !Number.isSafeInteger(e.sessionRevision) || e.sessionRevision < 1 || !e.result || e.result.playbackRequestId !== e.requestId || e.requestId !== this.playbackRequestId) throw new Error();
      if (!this.terminalSeen) {
        if (e.sessionRevision !== this.observedRevision + 1) throw new Error();
        this.observedRevision = e.sessionRevision; this.terminalSeen = true; this.emit('voiceEvent', e); }
      return;
    }
    if (!p) throw new Error();
    if (e.protocolVersion !== 1 || typeof e.eventId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(e.eventId) || e.requestId !== p.request.requestId || e.sessionId !== p.request.sessionId || e.leaseGeneration !== p.request.assistantLeaseGeneration || !Number.isSafeInteger(e.sessionRevision) || e.sessionRevision < p.request.expectedRevision || !['accepted', 'heartbeat', 'playback_started', 'paused', 'resumed', 'left', 'failed'].includes(e.eventType) || !e.result || typeof e.result !== 'object' || Array.isArray(e.result)) throw new Error();
    const expected: Record<VoiceRequest['operation'], string> = { health: 'heartbeat', reconcile: 'heartbeat', renew: 'heartbeat', 'prepare/join': 'heartbeat', 'start-local-media': 'playback_started', 'switch-local-media': 'playback_started', pause: 'paused', resume: 'resumed', stop: 'left', leave: 'left' };
    const readOnly = p.request.operation === 'health' || p.request.operation === 'reconcile' || p.request.operation === 'renew';
    if (e.eventType !== 'accepted' && (e.eventType !== expected[p.request.operation] && e.eventType !== 'failed' || e.sessionRevision !== p.request.expectedRevision + (readOnly ? 0 : 1))) throw new Error();
    if (e.eventType === 'accepted') return; // Not completion. Timer remains active.
    if (e.eventType === 'playback_started') this.playbackRequestId = p.request.requestId;
    this.observedRevision = e.sessionRevision;
    clearTimeout(p.timer); this.pending = undefined; p.resolve(e);
  }
  private signal(signal: NodeJS.Signals): void {
    if (!this.child.pid) return;
    try {
      if (process.platform !== 'win32') process.kill(-this.child.pid, signal);
      else this.child.kill(signal);
    } catch (error) {
      // Permission and unknown OS failures are not evidence of absence.
      if ((error as NodeJS.ErrnoException|null)?.code !== 'ESRCH') this.signalUncertain = true;
    }
  }
  private fail(code: string): void {
    const notify = !this.closed && !this.intentional;
    this.closed = true;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error(code)); this.pending = undefined; }
    this.signal('SIGKILL');
    if (notify) this.emit('voiceClosed', code);
  }
  async request(value: VoiceRequest): Promise<VoiceEvent> {
    if (this.closed || this.shuttingDown) throw new Error('VOICE_CLOSED');
    return this.sendRequest(value);
  }
  private async sendRequest(value: VoiceRequest): Promise<VoiceEvent> {
    const request = validateRequest(value);
    if (this.closed) throw new Error('VOICE_CLOSED');
    if (this.pending) throw new Error('VOICE_BUSY');
    if (this.binding && ['botId', 'chatId', 'sessionId', 'assistantLeaseGeneration'].some(k => this.binding![k as keyof VoiceRequest] !== request[k as keyof VoiceRequest])) throw new Error('VOICE_BINDING_INVALID');
    this.binding ??= request;
    const frame = encodeFrame(request);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail('VOICE_TIMEOUT'), this.timeoutMs);
      this.pending = { request, resolve, reject, timer };
      // One bounded frame at a time; callback errors and completion deadline cover blocked writes.
      this.child.stdin.write(frame, error => { if (error) this.fail('VOICE_EXITED'); });
    });
  }
  shutdown(): Promise<{clean:boolean}> {
    // One leave/exit/reap attempt per child: concurrent callers must not close
    // the transport underneath each other's native acknowledgement.
    this.shuttingDown = true;
    return this.shutdownWork ??= this.shutdownOnce();
  }
  private async shutdownOnce(): Promise<{clean:boolean}> {
    let left = false, forced = false;
    this.intentional = true;
    try {
      if (this.closed || !this.binding || this.pending) return {clean:false};
      const event = await this.sendRequest({...this.binding, requestId:randomUUID(), expectedRevision:this.observedRevision, operation:'leave',payload:{}});
      left = event.eventType === 'left' && event.result.state === 'idle';
      this.child.stdin.end();
      const timer = setTimeout(()=>{forced=true;this.signal('SIGKILL');},2000);
      try {await this.exited;} finally {clearTimeout(timer);}
      const clean = left && !forced && this.child.exitCode === 0;
      await this.close();
      return {clean:clean && this.groupGone && !this.signalUncertain};
    } catch {return {clean:false};}
    finally {await this.close();}
  }
  close(): Promise<void> {
    // Repeated calls must not signal a numeric process-group ID again after
    // this child's reap (that ID can eventually be reused by the OS).
    return this.closeWork ??= this.closeOnce();
  }
  private async closeOnce(): Promise<void> {
    this.intentional = true;
    this.closed = true;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error('VOICE_CLOSED')); this.pending = undefined; }
    this.child.stdin.end();
    this.signal('SIGTERM');
    const kill = setTimeout(() => this.signal('SIGKILL'), 2000);
    try { await this.exited; } finally { this.signal('SIGKILL'); clearTimeout(kill); }
    // Child pipe closure alone does not prove the original group disappeared.
    // Cache the observation inside the single-flight cleanup, never re-probe a
    // completed child's numeric identity on subsequent shutdown calls.
    this.groupGone = await waitForProcessGroupExit(this.child.pid);
  }
}
