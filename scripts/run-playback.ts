import {PlaybackPreferences,requireVoiceMode} from '../packages/database/playback-preferences.js';
import {OwnershipOutbox} from '../packages/database/ownership-outbox.js';
import {WorkerRegistry} from '../packages/database/workers.js';
import {AuthenticatedSupervisor} from '../apps/bot-runtime/supervisor.js';
import {MongoClient} from 'mongodb';
import {randomUUID} from 'node:crypto';
import {executionConfig} from '../apps/bot-runtime/execution-config.js';
import {PlaybackRunner} from '../apps/bot-runtime/playback-runner.js';
import {pythonChildFactory} from '../apps/bot-runtime/python-child.js';
import {MongoQueue} from '../packages/database/queues.js';
import {AssistantLeases,type AssistantRecord} from '../packages/database/leases.js';
import type {QueueState} from '../packages/queue/state.js';
import {MongoAudit} from '../packages/observability/audit.js';

// Authenticated operator-only Phase 0 execution. No public onboarding endpoint.
async function main(){
 const config=executionConfig(process.env);
 const args=process.argv.slice(2),enqueue:string[]=[];let recover=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==='--recover')recover=true;
  else if(args[i]==='--enqueue'&&args[i+1]&&Object.hasOwn(config.mediaHandles,args[i+1]!))enqueue.push(args[++i]!);
  else throw new Error('ARGUMENT_INVALID');
 }
 const client=new MongoClient(config.mongodbUri,{serverSelectionTimeoutMS:3000,socketTimeoutMS:5000,maxPoolSize:5});
 await client.connect();
 try{
  const db=client.db(config.mongodbDb);
  const queue=new MongoQueue(db.collection<QueueState>('music_queues'),config.botId,config.chatId);
  const leases=new AssistantLeases(db.collection<AssistantRecord>('assistants'));
  const audit=new MongoAudit(db.collection('audit_events'));
  const registry=new WorkerRegistry(db.collection('worker_grants'),db.collection('bots'),db.collection('workers'));
  await registry.ensureIndexes();
  const relay=new OwnershipOutbox(db.collection('ownership_events'));await relay.ensureIndexes();
  const flush=async(botId:string)=>{await relay.flush(db.collection('workers'),{botId});await relay.flush(db.collection('assistants'),{botId});};
  const auditedRegistry={
   claim:registry.claim.bind(registry),
   heartbeat:async(...args:Parameters<WorkerRegistry['heartbeat']>)=>{await registry.heartbeat(...args);await flush(args[0].botId);},
   finish:async(...args:Parameters<WorkerRegistry['finish']>)=>{await registry.finish(...args);await flush(args[0].botId);},
  };
  const supervisor=new AuthenticatedSupervisor(auditedRegistry,{token:config.workerGrant,workerId:randomUUID(),expectedBotId:config.botId,heartbeatMs:5000,operationTimeoutMs:5000});
  const stop=()=>supervisor.stop();
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
  try{
   await supervisor.run(async(binding,signal)=>{
    // Pin the owner's startup preference before queue mutation or assistant access.
    // Existing VC sessions are never hot-switched by a preference write.
    requireVoiceMode(await new PlaybackPreferences(db.collection('bots')).read(binding.botId,binding.ownerId));
    await queue.ensureIndexes();await queue.initialize();await leases.ensureIndexes();await audit.ensureIndexes();
    if(signal.aborted)throw new Error('SUPERVISOR_STOPPED');
    if(!await db.collection('assistants').findOne({assistantId:config.assistantId,enabled:true}))throw new Error('ASSISTANT_NOT_PROVISIONED');
    const holderId=binding.workerId;
    const runner=new PlaybackRunner(queue,leases,pythonChildFactory({...config,script:'apps/voice-engine/server.py'}),e=>audit.append(e),{assistantId:config.assistantId,holderId,leaseTtlMs:30000,renewEveryMs:5000,operationTimeoutMs:5000});
    const abort=()=>runner.stop();signal.addEventListener('abort',abort,{once:true});
    try{
     if(recover)await runner.recover();
     for(const handle of enqueue){
      if(signal.aborted)throw new Error('SUPERVISOR_STOPPED');
      const s=await queue.read();await queue.apply(s.revision,{type:'enqueue',track:{id:randomUUID(),title:handle,mediaHandle:handle}});
     }
     while(!signal.aborted){const result=await runner.runOne();if(result!=='completed'&&result!=='skipped')break;}
     // A completed run is not cleanup evidence if this holder still has a lease.
     const remaining=await db.collection('assistants').countDocuments({holderId,state:'leased'});
     return {clean:remaining===0};
    }finally{signal.removeEventListener('abort',abort);}
   });
  }finally{process.off('SIGTERM',stop);process.off('SIGINT',stop);}

 }finally{await client.close();}
}
main().catch((error:unknown)=>{
 if(error instanceof Error&&error.message==='WEBAPP_PLAYBACK_NOT_AVAILABLE')console.error('WEBAPP_PLAYBACK_NOT_AVAILABLE: owner selected WebApp; no VC fallback or assistant start was attempted.');
 else console.error('PHASE0_EXECUTION_FAILED: inspect scoped audit records; no automatic lease reset was performed.');
 process.exitCode=1;
});
