import type {Collection,Document} from 'mongodb';
const types=new Set(['worker_abandoned','assistant_abandoned','worker_claimed','worker_heartbeat','worker_stopped','worker_quarantined','assistant_acquired','assistant_renewed','assistant_released']);
const fields=new Set(['eventId','type','botId','ownerId','workerId','holderId','assistantId','chatId','generation','createdAt']);
/** Internal relay. Archive first, acknowledge second. Unique eventId makes replay safe.
 * No destructive truncation: malformed records and archive failures remain pending.
 */
export class OwnershipOutbox {
 constructor(private readonly archive:Collection){}
 async ensureIndexes():Promise<void>{
  await this.archive.createIndex({eventId:1},{unique:true,name:'ownership_event_identity'});
  await this.archive.createIndex({botId:1,createdAt:1});
 }
 async flush(source:Collection,scope:{botId:string},limit=100):Promise<number>{
  if(!/^[1-9]\d{0,19}$/.test(scope.botId)||!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Error('OWNERSHIP_SCOPE_INVALID');
  let count=0;
  while(count<limit){
   // The event retains tenant scope even when release removes live holder fields.
   const record=await source.findOne({'ownershipOutbox.botId':scope.botId},{projection:{ownershipOutbox:1}});
   if(!record)return count;
   const event=Array.isArray(record.ownershipOutbox)?record.ownershipOutbox.find((e:Document)=>e.botId===scope.botId):undefined;
   if(!event||Object.keys(event).some(k=>!fields.has(k))||!types.has(event.type)||typeof event.eventId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(event.eventId)||event.botId!==scope.botId||!Number.isSafeInteger(event.generation)||event.generation<1)throw new Error('OWNERSHIP_EVENT_INVALID');
   for(const key of ['ownerId','workerId','holderId','assistantId','chatId']){
    if(event[key]!==undefined&&(typeof event[key]!=='string'||!/^[-A-Za-z0-9_]{1,128}$/.test(event[key])))throw new Error('OWNERSHIP_EVENT_INVALID');
   }
   if(event.createdAt!==undefined&&(!(event.createdAt instanceof Date)||!Number.isFinite(event.createdAt.getTime())))throw new Error('OWNERSHIP_EVENT_INVALID');
   await this.archive.updateOne({eventId:event.eventId},{$setOnInsert:event,$currentDate:{archivedAt:true}},{upsert:true});
   const update:Document={$pull:{ownershipOutbox:{eventId:event.eventId,botId:scope.botId}}};
   const ack=await source.updateOne({_id:record._id,'ownershipOutbox.eventId':event.eventId},update);
   if(ack.matchedCount!==1)throw new Error('OWNERSHIP_ACK_CONFLICT');
   count++;
  }
  return count;
 }
}
