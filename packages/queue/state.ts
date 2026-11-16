export interface Track { id: string; mediaHandle: string; title: string }
export interface Source { sessionId: string; generation: number; requestId: string }
export interface TerminalReceipt {
  type: 'ended' | 'disconnected'; source: Source; trackId: string; revision: number;
}
export interface QueueState {
  botId: string; chatId: string; revision: number;
  current: { track: Track; state: 'preparing' | 'playing' | 'paused' | 'interrupted'; source: Source | null } | null;
  upcoming: Track[]; savedUpcoming: Track[];
  /** Embedded atomic journal; absent only on legacy documents. Never silently truncate. */
  terminalReceipts?: TerminalReceipt[];
  intent: { type: 'start' | 'stop' | 'pause' | 'resume'; id: string } | null;
}
export type Action = { type: 'enqueue'; track: Track } | { type: 'begin' | 'confirmed' | 'ended' | 'disconnected'; source: Source } | { type: 'control-confirmed'; source: Source; control: 'pause' | 'resume' } | { type: 'skip' | 'stop' | 'pause' | 'resume' | 'recover' | 'restore' };
export function emptyQueue(botId: string, chatId: string): QueueState {
  if (!/^[1-9]\d{0,19}$/.test(botId) || !/^-[1-9]\d{0,19}$/.test(chatId)) throw new Error('QUEUE_SCOPE_INVALID');
  return { botId, chatId, revision: 0, current: null, upcoming: [], savedUpcoming: [], intent: null, terminalReceipts: [] };
}
const id = (s: string) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s);
export function transition(previous: QueueState, action: Action): QueueState {
  const s = structuredClone(previous);
  if (!Number.isSafeInteger(s.revision) || s.revision >= Number.MAX_SAFE_INTEGER) throw new Error('REVISION_INVALID');
  s.revision++;
  const intent = (type: NonNullable<QueueState['intent']>['type']) => ({ type, id: `${s.botId}_${s.chatId}_${s.revision}` });
  const stage = () => {
    const track = s.upcoming.shift();
    s.current = track ? { track, state: 'preparing', source: null } : null;
    s.intent = track ? intent('start') : intent('stop');
  };
  if ('source' in action) {
    const source = action.source;
    if (!id(source.sessionId) || !id(source.requestId) || !Number.isSafeInteger(source.generation) || source.generation < 1) throw new Error('SOURCE_INVALID');
    if (action.type !== 'begin' && (!s.current?.source || ['sessionId', 'generation', 'requestId'].some(k => s.current!.source![k as keyof Source] !== source[k as keyof Source]))) throw new Error('SOURCE_STALE');
  }
  const journalCapacity = () => {
    if (s.terminalReceipts !== undefined && !Array.isArray(s.terminalReceipts)) throw new Error('TERMINAL_JOURNAL_INVALID');
    if ((s.terminalReceipts?.length ?? 0) >= 100) throw new Error('TERMINAL_JOURNAL_FULL');
  };
  const receipt = (type: TerminalReceipt['type'], source: Source) => {
    journalCapacity();
    (s.terminalReceipts ??= []).push({type,source:{sessionId:source.sessionId,generation:source.generation,requestId:source.requestId},trackId:s.current!.track.id,revision:s.revision});
  };
  switch (action.type) {
    case 'enqueue': {
      const t = action.track;
      if (Object.keys(t).sort().join(',') !== 'id,mediaHandle,title' || !id(t.id) || !id(t.mediaHandle) || typeof t.title !== 'string' || !t.title.trim() || t.title.length > 256) throw new Error('TRACK_INVALID');
      if (s.upcoming.length >= 20) throw new Error('QUEUE_FULL');
      if (s.current?.track.id === t.id || s.upcoming.some(x => x.id === t.id)) throw new Error('TRACK_DUPLICATE');
      s.upcoming.push(structuredClone(t)); break;
    }
    case 'begin':
      journalCapacity();
      if (!s.current) stage();
      if (!s.current || s.current.state !== 'preparing' || s.current.source) throw new Error('STATE_INVALID');
      s.current.source = structuredClone(action.source);
      s.intent = intent('start'); break;
    case 'confirmed':
      if (s.current!.state !== 'preparing') throw new Error('STATE_INVALID');
      s.current!.state = 'playing'; s.intent = null; break;
    case 'control-confirmed':
      if (s.intent?.type !== action.control || !s.current) throw new Error('STATE_INVALID');
      s.current.state = action.control === 'pause' ? 'paused' : 'playing'; s.intent = null; break;
    case 'ended':
      if (!['playing', 'paused'].includes(s.current!.state)) throw new Error('STATE_INVALID');
      receipt('ended',action.source);
      stage(); break;
    case 'disconnected':
      if (s.current!.state === 'interrupted') throw new Error('STATE_INVALID');
      receipt('disconnected',action.source);
      s.current!.state = 'interrupted'; s.intent = null; break;
    case 'skip':
      if (!s.current || !['playing', 'paused'].includes(s.current.state)) throw new Error('STATE_INVALID');
      // Consumer must terminate/reap the old child before dispatching this start intent.
      stage(); break;
    case 'stop':
      s.current = null; s.upcoming = []; s.savedUpcoming = []; s.intent = intent('stop'); break;
    case 'pause': case 'resume':
      if (!s.current || s.current.state !== (action.type === 'pause' ? 'playing' : 'paused') || s.intent) throw new Error('STATE_INVALID');
      // Desired control only. Observed state changes on a confirmed acknowledgement.
      s.intent = intent(action.type); break;
    case 'recover':
      s.savedUpcoming = s.upcoming.length ? s.upcoming : s.savedUpcoming;
      s.current = null; s.upcoming = []; s.intent = null; break;
    case 'restore':
      if (!s.current || s.current.state !== 'playing' || s.upcoming.length + s.savedUpcoming.length > 20) throw new Error('STATE_INVALID');
      s.upcoming.push(...s.savedUpcoming); s.savedUpcoming = []; break;
    default: throw new Error('ACTION_INVALID');
  }
  return s;
}
