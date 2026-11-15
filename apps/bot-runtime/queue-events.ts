import type { VoiceEvent } from './voice-process.js';
import type { Action, QueueState } from '../../packages/queue/state.js';
interface QueueRepository { read(): Promise<QueueState>; apply(revision: number, action: Action): Promise<QueueState> }
/** Call with a queue obtained from the trusted worker binding, not event-supplied tenant data. */
export async function applyNativeEvent(queue: QueueRepository, event: VoiceEvent): Promise<boolean> {
  if (!['media_ended','disconnected'].includes(event.eventType) || event.result.playbackRequestId !== event.requestId) throw new Error('EVENT_INVALID');
  for (let attempt=0;attempt<3;attempt++) {
    const state = await queue.read();
    const source = state.current?.source;
    if (!source || source.sessionId !== event.sessionId || source.generation !== event.leaseGeneration || source.requestId !== event.requestId || state.current?.state === 'interrupted') return false;
    try {
      await queue.apply(state.revision,{type:event.eventType === 'media_ended' ? 'ended':'disconnected',source});
      return true;
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'STALE_REVISION') throw error;
    }
  }
  throw new Error('QUEUE_CONTENTION');
}
