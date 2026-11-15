import type {Collection} from 'mongodb';
import type {RunnerEvent} from '../../apps/bot-runtime/playback-runner.js';
const types=new Set(['assistant_acquired','assistant_renewed','assistant_released','child_started','child_exited','playback_started','playback_paused','playback_resumed','playback_completed','playback_interrupted','playback_failed','queue_recovered','queue_advanced','cleanup_uncertain','recovery_required']);
/** Deliberately no arbitrary metadata/error text field: credential values cannot enter the record. */
export class MongoAudit {
 constructor(private readonly collection:Collection){}
 async append(event:RunnerEvent):Promise<void>{
  if(Object.keys(event).sort().join(',')!=='botId,chatId,generation,sessionId,type'||!types.has(event.type)||!/^\d{1,20}$/.test(event.botId)||!/^-[1-9]\d{0,19}$/.test(event.chatId)||!/^[A-Za-z0-9_-]{1,128}$/.test(event.sessionId)||!Number.isSafeInteger(event.generation)||event.generation<0)throw new Error('AUDIT_INVALID');
  await this.collection.insertOne({...event,createdAt:new Date()});
 }
 async ensureIndexes():Promise<void>{await this.collection.createIndex({botId:1,createdAt:-1});}
}
