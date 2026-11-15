import {randomUUID} from 'node:crypto';
import type {Document} from 'mongodb';
export const ownershipCapacity={'ownershipOutbox.99':{$exists:false}};
type Type='worker_claimed'|'worker_heartbeat'|'worker_stopped'|'worker_quarantined'|'assistant_acquired'|'assistant_renewed'|'assistant_released';
/** Aggregation pipeline stage: project only whitelisted scope from the current record.
 * Invoke after generation allocation and BEFORE removal of live ownership fields.
 */
export function ownershipEvent(type:Type):Document{
 const worker=type.startsWith('worker_');
 const event:Document={eventId:{$literal:randomUUID()},type:{$literal:type},botId:'$botId',generation:'$generation',createdAt:'$$NOW'};
 if(worker){event.ownerId='$ownerId';event.workerId='$workerId';}
 else{event.assistantId='$assistantId';event.holderId='$holderId';event.chatId='$chatId';}
 return {$set:{ownershipOutbox:{$concatArrays:[{$ifNull:['$ownershipOutbox',[]]},[event]]}}};
}
