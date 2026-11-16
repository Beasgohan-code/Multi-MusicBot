import {MongoClient} from 'mongodb';
import {AbandonedOwnership} from '../packages/database/reconciliation.js';
import {TerminalOutbox} from '../packages/database/terminal-outbox.js';
import type {QueueState} from '../packages/queue/state.js';
import {OwnershipOutbox} from '../packages/database/ownership-outbox.js';
/** Trusted operator CLI, not a tenant endpoint. Mongo credentials authorize this tool.
 * One bounded batch per invocation. No secrets or raw database errors are printed.
 */
async function main(){
 const uri=process.env.MONGODB_URI??'',name=process.env.MONGODB_DB??'',botId=process.env.VOICE_BOT_ID??'';
 if(!/^mongodb(?:\+srv)?:\/\/[^\s]+$/.test(uri)||!/^[A-Za-z0-9_-]{1,63}$/.test(name)||!/^[1-9]\d{0,19}$/.test(botId)||process.argv.length!==2)throw new Error('MAINTENANCE_CONFIG_INVALID');
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:3000,socketTimeoutMS:5000,maxPoolSize:3});
 try{
  await client.connect();const db=client.db(name),workers=db.collection('workers'),assistants=db.collection('assistants');
  const relay=new OwnershipOutbox(db.collection('ownership_events'));await relay.ensureIndexes();
  const terminals=new TerminalOutbox(db.collection('terminal_events'));await terminals.ensureIndexes();
  const terminalEventsDelivered=await terminals.flush(db.collection<QueueState>('music_queues'),{botId});
  const before=await relay.flush(workers,{botId})+await relay.flush(assistants,{botId});
  const result=await new AbandonedOwnership(workers,assistants).scan(botId);
  const after=await relay.flush(workers,{botId})+await relay.flush(assistants,{botId});
  console.log(JSON.stringify({inspected:result.inspected,quarantined:result.quarantined,eventsDelivered:before+after,terminalEventsDelivered,cleanupConfirmed:false}));
 }finally{await client.close();}
}
main().catch(()=>{console.error('OWNERSHIP_MAINTENANCE_FAILED: no cleanup or takeover was confirmed.');process.exitCode=1;});
