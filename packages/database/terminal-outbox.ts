import type {Collection,Document} from 'mongodb';
import type {QueueState,TerminalReceipt} from '../queue/state.js';
const id=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
/** Trusted operator/runtime relay. Archive before ack; never replay playback from a receipt. */
export class TerminalOutbox {
 constructor(private readonly archive:Collection){}
 async ensureIndexes():Promise<void>{
  await this.archive.createIndex({botId:1,chatId:1,revision:1},{unique:true,name:'terminal_event_identity'});
 }
 async flush(queues:Collection<QueueState>,scope:{botId:string},limit=100):Promise<number>{
  if(typeof scope.botId!=='string'||!/^[1-9]\d{0,19}$/.test(scope.botId)||!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new Error('TERMINAL_SCOPE_INVALID');
  let count=0;
  while(count<limit){
   const state=await queues.findOne({botId:scope.botId,'terminalReceipts.0':{$exists:true}},{projection:{botId:1,chatId:1,revision:1,terminalReceipts:1}});
   if(!state)return count;
   const receipt:TerminalReceipt|undefined=Array.isArray(state.terminalReceipts)?state.terminalReceipts[0]:undefined;
   if(state.botId!==scope.botId||typeof state.chatId!=='string'||!/^-[1-9]\d{0,19}$/.test(state.chatId)||!Number.isSafeInteger(state.revision)||state.revision<1||state.revision>=Number.MAX_SAFE_INTEGER||!receipt||state.terminalReceipts!.length>100||new Set(state.terminalReceipts!.map(r=>r?.revision)).size!==state.terminalReceipts!.length||Object.keys(receipt).sort().join(',')!=='revision,source,trackId,type'||!['ended','disconnected'].includes(receipt.type)||!id(receipt.trackId)||!Number.isSafeInteger(receipt.revision)||receipt.revision<1||receipt.revision>state.revision||!receipt.source||Object.keys(receipt.source).sort().join(',')!=='generation,requestId,sessionId'||!id(receipt.source.sessionId)||!id(receipt.source.requestId)||!Number.isSafeInteger(receipt.source.generation)||receipt.source.generation<1)throw new Error('TERMINAL_EVENT_INVALID');
   // Include immutable content in the upsert filter. An identity/content collision
   // fails the unique index instead of acknowledging evidence that was not archived.
   const event={botId:scope.botId,chatId:state.chatId,...receipt};
   const archived=await this.archive.updateOne(event,{$setOnInsert:{...event,archivedAt:new Date()}},{upsert:true,writeConcern:{w:'majority'}});
   if(!archived.acknowledged)throw new Error('TERMINAL_ARCHIVE_UNCONFIRMED');
   // Every journal ack changes the queue revision: replaceOne from an older read
   // must fail CAS rather than resurrect an already-archived receipt.
   const update:Document={$pull:{terminalReceipts:{revision:receipt.revision}},$inc:{revision:1}};
   const ack=await queues.updateOne({botId:scope.botId,chatId:state.chatId,revision:state.revision,terminalReceipts:{$elemMatch:receipt}},update,{writeConcern:{w:'majority'}});
   if(!ack.acknowledged||ack.matchedCount!==1)throw new Error('TERMINAL_ACK_CONFLICT');
   count++;
  }
  return count;
 }
}
