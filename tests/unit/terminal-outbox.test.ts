import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Collection,Document} from 'mongodb';
import {MongoQueue} from '../../packages/database/queues.js';
import {TerminalOutbox} from '../../packages/database/terminal-outbox.js';
import {emptyQueue,transition,type QueueState} from '../../packages/queue/state.js';
const source={sessionId:'s',generation:1,requestId:'r'};
function fixture(){
 let state=emptyQueue('123','-1001');
 for(const id of ['a','b'])state=transition(state,{type:'enqueue',track:{id,title:id,mediaHandle:id}});
 state=transition(state,{type:'begin',source});state=transition(state,{type:'confirmed',source});state=transition(state,{type:'ended',source});
 const archives=new Map<string,Document>(),calls:string[]=[];let ackFails=false,archiveFails=false,conflict=false;
 const queues={async findOne(f:Document){assert.equal(f.botId,'123');return !f['terminalReceipts.0']||state.terminalReceipts?.length?structuredClone(state):null;},async updateOne(f:Document,u:Document,options:Document){assert.equal(options.writeConcern.w,'majority');
  calls.push('ack');assert.equal(f.botId,'123');assert.equal(f.chatId,'-1001');assert.equal(f.revision,state.revision);
  assert.deepEqual(f.terminalReceipts.$elemMatch,state.terminalReceipts![0]);
  if(ackFails)throw new Error('ACK_DOWN');
  if(conflict){state=transition(state,{type:'enqueue',track:{id:'c',title:'c',mediaHandle:'c'}});conflict=false;return {matchedCount:0};}
  state.terminalReceipts=state.terminalReceipts!.filter(r=>r.revision!==u.$pull.terminalReceipts.revision);state.revision+=u.$inc.revision;return {acknowledged:true,matchedCount:1};
 }} as unknown as Collection<QueueState>;
 const sink={async createIndex(){},async updateOne(f:Document,u:Document,options:Document){assert.equal(options.writeConcern.w,'majority');calls.push('archive');if(archiveFails)throw new Error('ARCHIVE_DOWN');const key=[f.botId,f.chatId,f.revision].join(':');const existing=archives.get(key);if(existing){const {archivedAt,...content}=existing;assert.deepEqual(content,f);}else archives.set(key,u.$setOnInsert);return {acknowledged:true,matchedCount:1};}} as unknown as Collection;
 return {queues,sink,calls,archives,get state(){return state;},set ackFails(v:boolean){ackFails=v;},set archiveFails(v:boolean){archiveFails=v;},set conflict(v:boolean){conflict=v;}};
}
test('terminal archive precedes revision-fenced acknowledgement and preserves playback state',async()=>{
 const h=fixture(),before=structuredClone(h.state);const relay=new TerminalOutbox(h.sink);await relay.ensureIndexes();
 assert.equal(await relay.flush(h.queues,{botId:'123'}),1);assert.deepEqual(h.calls,['archive','ack']);
 assert.equal(h.state.revision,before.revision+1);assert.deepEqual(h.state.current,before.current);assert.deepEqual(h.state.upcoming,before.upcoming);
 assert.deepEqual(h.state.terminalReceipts,[]);assert.equal(h.archives.size,1);
 const event=[...h.archives.values()][0]!;assert.equal(event.botId,'123');assert.equal(event.chatId,'-1001');assert.equal(event.trackId,'a');
});
test('archive outage never acknowledges receipt',async()=>{
 const h=fixture();h.archiveFails=true;await assert.rejects(new TerminalOutbox(h.sink).flush(h.queues,{botId:'123'}),/ARCHIVE_DOWN/);
 assert.equal(h.state.terminalReceipts?.length,1);assert.deepEqual(h.calls,['archive']);
});
test('ack outage replays idempotently after restart without duplicate archive identity',async()=>{
 const h=fixture();h.ackFails=true;await assert.rejects(new TerminalOutbox(h.sink).flush(h.queues,{botId:'123'}),/ACK_DOWN/);
 h.ackFails=false;assert.equal(await new TerminalOutbox(h.sink).flush(h.queues,{botId:'123'}),1);assert.equal(h.archives.size,1);
});
test('concurrent queue mutation fences acknowledgement without losing or overwriting state',async()=>{
 const h=fixture();h.conflict=true;await assert.rejects(new TerminalOutbox(h.sink).flush(h.queues,{botId:'123'}),/TERMINAL_ACK_CONFLICT/);
 assert.equal(h.state.terminalReceipts?.length,1);assert.equal(h.state.upcoming[0]?.id,'c');
 await new TerminalOutbox(h.sink).flush(h.queues,{botId:'123'});assert.equal(h.archives.size,1);assert.equal(h.state.upcoming[0]?.id,'c');
});
test('stale queue replacement cannot resurrect a receipt after acknowledgement',async()=>{
 const h=fixture();const observed=structuredClone(h.state);await new TerminalOutbox(h.sink).flush(h.queues,{botId:'123'});
 await assert.rejects(new MongoQueue(h.queues,'123','-1001').apply(observed.revision,{type:'stop'}),/STALE_REVISION/);
 assert.notEqual(observed.revision,h.state.revision);assert.equal(h.state.terminalReceipts?.length,0);
});
test('malformed, cross-tenant and secret-bearing receipts fail before archive or ack',async()=>{
 for(const patch of [{botId:'999'},{chatId:'invalid'},{revision:0},{terminalReceipts:[{type:'ended',source,trackId:'a',revision:999}]},{terminalReceipts:[{type:'ended',source:{...source,secret:'hidden'},trackId:'a',revision:5}]},{terminalReceipts:[{type:'ended',source,trackId:'a',revision:5,secret:'hidden'}]}]){
  const h=fixture();Object.assign(h.state,patch);
  await assert.rejects(new TerminalOutbox(h.sink).flush(h.queues,{botId:'123'}),/TERMINAL_EVENT_INVALID/);assert.deepEqual(h.calls,[]);
 }
});
test('relay rejects invalid scope/limit and enforces bounded batch size',async()=>{
 const h=fixture();const relay=new TerminalOutbox(h.sink);
 for(const limit of [0,1001,1.5])await assert.rejects(relay.flush(h.queues,{botId:'123'},limit),/TERMINAL_SCOPE_INVALID/);
 await assert.rejects(relay.flush(h.queues,{botId:'bad'}),/TERMINAL_SCOPE_INVALID/);
 assert.equal(await relay.flush(h.queues,{botId:'123'},1),1);assert.deepEqual(h.calls,['archive','ack']);
});

test('duplicate receipt revisions are rejected rather than bulk-acknowledged',async()=>{
 const h=fixture();h.state.terminalReceipts!.push({...h.state.terminalReceipts![0]!,trackId:'other'});
 await assert.rejects(new TerminalOutbox(h.sink).flush(h.queues,{botId:'123'}),/TERMINAL_EVENT_INVALID/);
 assert.equal(h.state.terminalReceipts?.length,2);assert.deepEqual(h.calls,[]);
});
test('archive identity collision cannot acknowledge conflicting evidence',async()=>{
 const h=fixture();const sink={updateOne:async()=>{throw new Error('E11000');}} as unknown as Collection;
 await assert.rejects(new TerminalOutbox(sink).flush(h.queues,{botId:'123'}),/E11000/);
 assert.equal(h.state.terminalReceipts?.length,1);assert.deepEqual(h.calls,[]);
});
test('bounded relay frees a full journal only through successful archive acknowledgements',async()=>{
 const h=fixture();h.state.revision=100;
 h.state.terminalReceipts=Array.from({length:100},(_,i)=>({type:'ended' as const,source:{...source,requestId:'r_'+i},trackId:'a',revision:i+1}));
 assert.throws(()=>transition(h.state,{type:'begin',source}),/TERMINAL_JOURNAL_FULL/);
 assert.equal(await new TerminalOutbox(h.sink).flush(h.queues,{botId:'123'},100),100);
 assert.equal(h.archives.size,100);assert.deepEqual(h.state.terminalReceipts,[]);
 assert.equal(transition(h.state,{type:'begin',source}).current?.source?.requestId,'r');
});
test('unacknowledged archive cannot authorize journal removal',async()=>{
 const h=fixture();const sink={updateOne:async()=>({acknowledged:false})} as unknown as Collection;
 await assert.rejects(new TerminalOutbox(sink).flush(h.queues,{botId:'123'}),/TERMINAL_ARCHIVE_UNCONFIRMED/);
 assert.equal(h.state.terminalReceipts?.length,1);assert.deepEqual(h.calls,[]);
});
test('unacknowledged queue ack cannot be reported as delivery',async()=>{
 const h=fixture();const queues={findOne:h.queues.findOne.bind(h.queues),updateOne:async()=>({acknowledged:false,matchedCount:1})} as unknown as Collection<QueueState>;
 await assert.rejects(new TerminalOutbox(h.sink).flush(queues,{botId:'123'},1),/TERMINAL_ACK_CONFLICT/);
 assert.equal(h.state.terminalReceipts?.length,1);
});
