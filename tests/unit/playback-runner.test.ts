import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PlaybackRunner } from '../../apps/bot-runtime/playback-runner.js';
import { emptyQueue, transition, type Action } from '../../packages/queue/state.js';
import type { VoiceRequest } from '../../packages/shared/protocol.js';
import type { VoiceEvent } from '../../apps/bot-runtime/voice-process.js';

function harness(options: {cleanup?:boolean; renewFails?:boolean; persistFails?:boolean; crash?:boolean; releaseFails?:boolean; completionDelayMs?:number; disconnect?:boolean; cleanupGate?:Promise<void>; acquireGate?:Promise<void>; renewGate?:Promise<void>; onRenew?:()=>void; queueGate?:Promise<void>; gatedAction?:Action['type']; releaseGate?:Promise<void>; operationTimeoutMs?:number}={}) {
 let state=emptyQueue('123','-1001');
 for(const id of ['a','b']) state=transition(state,{type:'enqueue',track:{id,title:id,mediaHandle:id}});
 const log:string[]=[]; const releaseBindings:{assistantId:string;holder:string;generation:number}[]=[]; let acquired=false; let generation=0; let lastChild:Child|undefined;
 const queue={async read(){return structuredClone(state);}, async apply(rev:number,a:Action){
  log.push('queue_action:'+a.type);
  if(options.queueGate&&options.gatedAction===a.type)await options.queueGate;
  if(options.persistFails && (a.type==='ended'||a.type==='disconnected')) throw new Error('DB_DOWN');
  if(rev!==state.revision)throw new Error('STALE_REVISION');state=transition(state,a);return structuredClone(state);
 }};
 const leases={async acquire(){log.push('acquire_requested');if(options.acquireGate)await options.acquireGate;if(acquired)throw new Error('ASSISTANT_BUSY');acquired=true;log.push('acquire');return {generation:++generation};},async renew(){log.push('renew');options.onRenew?.();if(options.renewGate)await options.renewGate;log.push('renew_settled');if(options.renewFails)throw new Error('DB_DOWN');return {generation};},async releaseAfterCleanup(assistantId:string,holder:string,generation:number){releaseBindings.push({assistantId,holder,generation});if(options.releaseGate)await options.releaseGate;if(options.releaseFails)throw new Error('DB_DOWN');log.push('release');acquired=false;}};
 class Child extends EventEmitter {
  source:VoiceRequest|undefined;
  revision=0;
  async request(r:VoiceRequest):Promise<VoiceEvent>{
   if(r.operation==='renew')log.push('child_renew');
   if(r.operation!=='renew')this.revision=r.expectedRevision+1;
   if(r.operation==='start-local-media') {
    this.source=r;log.push('start');
    setTimeout(()=>{
     if(options.crash){this.emit('voiceClosed','VOICE_EXITED');return;}
     if(options.renewFails)return;
     const e:VoiceEvent={protocolVersion:1,eventId:'end',requestId:r.requestId,sessionId:r.sessionId,leaseGeneration:r.assistantLeaseGeneration,sessionRevision:this.revision+1,eventType:options.disconnect?'disconnected':'media_ended',result:{playbackRequestId:r.requestId}};
     this.emit('voiceEvent',e);this.emit('voiceEvent',e);
    },options.completionDelayMs??5);
   }
   return {protocolVersion:1,eventId:'ack',requestId:r.requestId,sessionId:r.sessionId,leaseGeneration:r.assistantLeaseGeneration,sessionRevision:r.expectedRevision+(r.operation==='renew'?0:1),eventType:r.operation==='renew'?'heartbeat':r.operation==='pause'?'paused':r.operation==='resume'?'resumed':'playback_started',result:{state:'playing'}};
  }
  async shutdown(){if(options.cleanupGate)await options.cleanupGate;log.push('reap');return {clean:options.cleanup!==false};}
 }
 const runner=new PlaybackRunner(queue,leases,()=>{lastChild=new Child();return lastChild;},async e=>{log.push('audit:'+e.type);},{assistantId:'assistant1',holderId:'worker1',leaseTtlMs:1000,renewEveryMs:20,operationTimeoutMs:options.operationTimeoutMs??200});
 return {runner,log,queue,releaseBindings,get acquired(){return acquired;},get child(){return lastChild;}};
}
test('runner commits completion once, reaps then releases before next start',async()=>{
 const h=harness();assert.equal(await h.runner.runOne(),'completed');
 assert.equal((await h.queue.read()).current?.track.id,'b');
 assert.equal(h.acquired,false);
 assert.ok(h.log.indexOf('reap')<h.log.indexOf('release'));
 assert.equal(await h.runner.runOne(),'completed');
 assert.equal(h.log.filter(x=>x==='start').length,2);
});
test('uncertain cleanup never releases assistant or starts another track',async()=>{
 const h=harness({cleanup:false});await assert.rejects(h.runner.runOne(),/CLEANUP_UNCERTAIN/);
 assert.equal(h.acquired,true);assert.ok(!h.log.includes('release'));
 await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
});
test('renewal failure tears down child and interrupts instead of advancing',async()=>{
 const h=harness({renewFails:true});assert.equal(await h.runner.runOne(),'interrupted');
 assert.ok(h.log.includes('renew'));assert.ok(h.log.includes('reap'));
 assert.equal((await h.queue.read()).current?.state,'interrupted');
 assert.equal((await h.queue.read()).upcoming[0]?.id,'b');
});
test('crash and persistence failure never claim completion or resume old start intent',async()=>{
 const crash=harness({crash:true,cleanup:false});await assert.rejects(crash.runner.runOne(),/CLEANUP_UNCERTAIN/);
 const h=harness({persistFails:true});await assert.rejects(h.runner.runOne(),/DB_DOWN/);
 assert.ok(h.log.includes('reap'));await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
 assert.equal((await h.queue.read()).current?.track.id,'a');
});
test('explicit recovery never replays an existing start after persistence failure',async()=>{
 const h=harness({persistFails:true});await assert.rejects(h.runner.runOne());
 await h.runner.recover();const s=await h.queue.read();
 assert.equal(s.current,null);assert.equal(s.intent,null);assert.equal(s.savedUpcoming[0]?.id,'b');
});
test('successful renewal keeps playback active and cleanup outage retains lease',async()=>{
 const h=harness({completionDelayMs:80});assert.equal(await h.runner.runOne(),'completed');
 assert.ok(h.log.filter(x=>x==='renew').length>=1);
 const outage=harness({releaseFails:true});await assert.rejects(outage.runner.runOne(),/DB_DOWN/);
 assert.equal(outage.acquired,true);await assert.rejects(outage.runner.runOne(),/RUNNER_BLOCKED/);
});
test('persisted skip cancels/reaps active child before the next staged track',async()=>{
 const h=harness({completionDelayMs:150});const work=h.runner.runOne();
 await new Promise(resolve=>setTimeout(resolve,15));
 const s=await h.queue.read();await h.queue.apply(s.revision,{type:'skip'});
 assert.equal(await work,'skipped');
 assert.equal((await h.queue.read()).current?.track.id,'b');
 assert.equal(h.log.filter(x=>x==='start').length,1);
 assert.ok(h.log.indexOf('reap')<h.log.indexOf('release'));
});
test('disconnect interrupts without consuming upcoming tracks',async()=>{
 const h=harness({disconnect:true});assert.equal(await h.runner.runOne(),'interrupted');
 const s=await h.queue.read();assert.equal(s.current?.state,'interrupted');assert.equal(s.upcoming[0]?.id,'b');
});
test('persisted pause and resume are applied through confirmed IPC acknowledgements',async()=>{
 const h=harness({completionDelayMs:160});const work=h.runner.runOne();
 await new Promise(resolve=>setTimeout(resolve,15));let s=await h.queue.read();await h.queue.apply(s.revision,{type:'pause'});
 await new Promise(resolve=>setTimeout(resolve,40));s=await h.queue.read();assert.equal(s.current?.state,'paused');
 await h.queue.apply(s.revision,{type:'resume'});
 await new Promise(resolve=>setTimeout(resolve,40));s=await h.queue.read();assert.equal(s.current?.state,'playing');
 assert.equal(await work,'completed');
});
test('queue recovery cannot clear uncertain-cleanup quarantine',async()=>{
 const h=harness({cleanup:false});await assert.rejects(h.runner.runOne());
 await h.runner.recover();
 await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
 assert.equal(h.acquired,true);
});
test('stop is latched before any run and prevents later assistant acquisition',async()=>{
 const h=harness();h.runner.stop();
 await assert.rejects(h.runner.runOne(),/RUNNER_STOPPED/);
 assert.equal(h.log.includes('acquire'),false);
});

test('cleanup timeout cannot settle the runner before the native shutdown actually finishes',async()=>{
 let reap!:()=>void;
 const gate=new Promise<void>(resolve=>{reap=resolve;});
 const h=harness({cleanupGate:gate,operationTimeoutMs:20});
 let settled=false;
 const work=h.runner.runOne();work.then(()=>{settled=true;},()=>{settled=true;});
 try{
  await new Promise(resolve=>setTimeout(resolve,70));
  assert.equal(settled,false,'supervisor must not finish the holder while native teardown is pending');
  assert.equal(h.acquired,true);assert.equal(h.log.includes('release'),false);
  await assert.rejects(h.runner.recover(),/RUNNER_BUSY/);
 }finally{reap();}
 await assert.rejects(work,/OPERATION_TIMEOUT/);
 assert.ok(h.log.includes('reap'));assert.equal(h.acquired,true);
 await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
});
test('late shutdown rejection is observed without releasing assistant ownership',async()=>{
 let rejectShutdown!:(error:Error)=>void;
 const gate=new Promise<void>((_,reject)=>{rejectShutdown=reject;});
 const h=harness({cleanupGate:gate,operationTimeoutMs:20});
 const work=h.runner.runOne();const rejection=assert.rejects(work,/OPERATION_TIMEOUT/);
 await new Promise(resolve=>setTimeout(resolve,70));
 assert.equal(h.acquired,true);assert.equal(h.log.includes('release'),false);
 rejectShutdown(new Error('NATIVE_FAILURE'));
 await rejection;
 assert.equal(h.acquired,true);await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
});

test('late successful acquire is settled and compensated without ever starting a child',async()=>{
 let resolveAcquire!:()=>void;
 const acquireGate=new Promise<void>(resolve=>{resolveAcquire=resolve;});
 const h=harness({acquireGate,operationTimeoutMs:20});
 let settled=false;const work=h.runner.runOne();work.then(()=>{settled=true;},()=>{settled=true;});
 try{
  await new Promise(resolve=>setTimeout(resolve,70));
  assert.equal(settled,false,'holder must remain active while acquisition can still complete');
  await assert.rejects(h.runner.recover(),/RUNNER_BUSY/);
  assert.equal(h.child,undefined);assert.equal(h.log.includes('release'),false);
 }finally{resolveAcquire();}
 await assert.rejects(work,/OPERATION_TIMEOUT/);
 assert.equal(h.child,undefined);assert.equal(h.acquired,false);
 assert.equal(h.log.filter(x=>x==='acquire_requested').length,1);
 assert.equal(h.log.filter(x=>x==='release').length,1);
 assert.deepEqual(h.releaseBindings,[{assistantId:'assistant1',holder:'worker1',generation:1}]);
 assert.equal((await h.queue.read()).current,null);
 await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
});
test('late rejected acquire is observed without pretending ownership was released',async()=>{
 let rejectAcquire!:(e:Error)=>void;
 const acquireGate=new Promise<void>((_,reject)=>{rejectAcquire=reject;});
 const h=harness({acquireGate,operationTimeoutMs:20});
 let settled=false;const work=h.runner.runOne();work.then(()=>{settled=true;},()=>{settled=true;});const rejection=assert.rejects(work,/OPERATION_TIMEOUT/);
 await new Promise(resolve=>setTimeout(resolve,70));
 try{assert.equal(settled,false);}finally{rejectAcquire(new Error('DB_DOWN'));}
 await rejection;
 assert.equal(h.child,undefined);assert.equal(h.log.includes('release'),false);
 assert.equal(h.log.filter(x=>x==='acquire_requested').length,1);
 await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
});

test('failure compensating a known late acquisition retains ownership and blocks replay',async()=>{
 let resolveAcquire!:()=>void;
 const acquireGate=new Promise<void>(resolve=>{resolveAcquire=resolve;});
 const h=harness({acquireGate,releaseFails:true,operationTimeoutMs:20});
 const work=h.runner.runOne();const rejection=assert.rejects(work,/DB_DOWN/);
 await new Promise(resolve=>setTimeout(resolve,70));resolveAcquire();await rejection;
 assert.equal(h.acquired,true);assert.equal(h.child,undefined);
 assert.deepEqual(h.releaseBindings,[{assistantId:'assistant1',holder:'worker1',generation:1}]);
 await h.runner.recover();await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
 assert.equal(h.log.filter(x=>x==='acquire_requested').length,1);
});

test('timed-out renewal reaps promptly but holds ownership until the same renewal settles',async()=>{
 let finishRenew!:()=>void,startRenew!:()=>void;
 const renewGate=new Promise<void>(resolve=>{finishRenew=resolve;});
 const started=new Promise<void>(resolve=>{startRenew=resolve;});
 const h=harness({renewGate,onRenew:startRenew,operationTimeoutMs:20,completionDelayMs:200});
 let settled=false;const work=h.runner.runOne();work.then(()=>{settled=true;},()=>{settled=true;});
 await started;
 try{
  await new Promise(resolve=>setTimeout(resolve,60));
  assert.ok(h.log.includes('reap'),'native cleanup must not wait for the DB renewal');
  assert.equal(settled,false);assert.equal(h.acquired,true);assert.equal(h.log.includes('release'),false);
  assert.equal(h.log.includes('child_renew'),false);
  await assert.rejects(h.runner.recover(),/RUNNER_BUSY/);
 }finally{finishRenew();}
 assert.equal(await work,'interrupted');
 assert.ok(h.log.indexOf('renew_settled')<h.log.indexOf('release'));
 assert.equal(h.log.filter(x=>x==='renew').length,1);assert.equal(h.log.filter(x=>x==='reap').length,1);
 assert.equal(h.log.includes('child_renew'),false);assert.equal((await h.queue.read()).upcoming[0]?.id,'b');
 await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
});
test('late renewal rejection is observed after teardown without early holder completion',async()=>{
 let failRenew!:(e:Error)=>void,startRenew!:()=>void;
 const renewGate=new Promise<void>((_,reject)=>{failRenew=reject;});
 const started=new Promise<void>(resolve=>{startRenew=resolve;});
 const h=harness({renewGate,onRenew:startRenew,operationTimeoutMs:20,completionDelayMs:200});
 let settled=false;const work=h.runner.runOne();work.then(()=>{settled=true;},()=>{settled=true;});
 await started;
 try{
  await new Promise(resolve=>setTimeout(resolve,60));assert.ok(h.log.includes('reap'));
  assert.equal(settled,false);assert.equal(h.log.includes('release'),false);
 }finally{failRenew(new Error('DB_DOWN'));}
 assert.equal(await work,'interrupted');assert.equal(h.log.includes('child_renew'),false);
 assert.equal(h.acquired,false);await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
});
test('completion concurrent with uncertain renewal cannot consume the upcoming track',async()=>{
 let finishRenew!:()=>void,startRenew!:()=>void;
 const renewGate=new Promise<void>(resolve=>{finishRenew=resolve;});
 const started=new Promise<void>(resolve=>{startRenew=resolve;});
 const h=harness({renewGate,onRenew:startRenew,operationTimeoutMs:20,completionDelayMs:200});
 const work=h.runner.runOne();await started;
 const r=h.child!.source!;
 h.child!.emit('voiceEvent',{protocolVersion:1,eventId:'end',requestId:r.requestId,sessionId:r.sessionId,leaseGeneration:r.assistantLeaseGeneration,sessionRevision:2,eventType:'media_ended',result:{playbackRequestId:r.requestId}});
 try{
  await new Promise(resolve=>setTimeout(resolve,60));
  assert.ok(h.log.includes('reap'));assert.equal((await h.queue.read()).upcoming[0]?.id,'b');
 }finally{finishRenew();}
 assert.equal(await work,'interrupted');assert.equal((await h.queue.read()).current?.state,'interrupted');
 assert.equal(h.log.includes('audit:playback_completed'),false);
});

test('uncertain native cleanup still waits for pending renewal and never releases the assistant',async()=>{
 let finishRenew!:()=>void,startRenew!:()=>void;
 const renewGate=new Promise<void>(resolve=>{finishRenew=resolve;});
 const started=new Promise<void>(resolve=>{startRenew=resolve;});
 const h=harness({renewGate,onRenew:startRenew,cleanup:false,operationTimeoutMs:20,completionDelayMs:200});
 let settled=false;const work=h.runner.runOne();work.then(()=>{settled=true;},()=>{settled=true;});
 const rejection=assert.rejects(work,/CLEANUP_UNCERTAIN/);await started;
 try{
  await new Promise(resolve=>setTimeout(resolve,60));assert.equal(settled,false);
  assert.ok(h.log.includes('reap'));assert.equal(h.log.includes('release'),false);
 }finally{finishRenew();}
 await rejection;assert.equal(h.acquired,true);assert.equal(h.log.filter(x=>x==='reap').length,1);
 await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
});
test('renewal loss tears down before failed queue persistence and drains renewal before rejecting',async()=>{
 let finishRenew!:()=>void,startRenew!:()=>void;
 const renewGate=new Promise<void>(resolve=>{finishRenew=resolve;});
 const started=new Promise<void>(resolve=>{startRenew=resolve;});
 const h=harness({renewGate,onRenew:startRenew,persistFails:true,operationTimeoutMs:20,completionDelayMs:200});
 let settled=false;const work=h.runner.runOne();work.then(()=>{settled=true;},()=>{settled=true;});
 const rejection=assert.rejects(work,/DB_DOWN/);await started;
 try{
  await new Promise(resolve=>setTimeout(resolve,60));assert.equal(settled,false);
  assert.ok(h.log.includes('queue_action:disconnected'));
  assert.ok(h.log.indexOf('reap')<h.log.indexOf('queue_action:disconnected'));
  assert.equal(h.log.includes('release'),false);
 }finally{finishRenew();}
 await rejection;assert.equal(h.acquired,false);assert.equal(h.log.filter(x=>x==='reap').length,1);
});
test('completion with a timely valid pending renewal still advances exactly once without extending the ended child',async()=>{
 let finishRenew!:()=>void,startRenew!:()=>void;
 const renewGate=new Promise<void>(resolve=>{finishRenew=resolve;});
 const started=new Promise<void>(resolve=>{startRenew=resolve;});
 const h=harness({renewGate,onRenew:startRenew,completionDelayMs:200});
 const work=h.runner.runOne();await started;
 const r=h.child!.source!;
 const end={protocolVersion:1,eventId:'end',requestId:r.requestId,sessionId:r.sessionId,leaseGeneration:r.assistantLeaseGeneration,sessionRevision:2,eventType:'media_ended',result:{playbackRequestId:r.requestId}};
 h.child!.emit('voiceEvent',end);h.child!.emit('voiceEvent',end);finishRenew();
 assert.equal(await work,'completed');assert.equal((await h.queue.read()).current?.track.id,'b');
 assert.equal(h.log.includes('child_renew'),false);assert.equal(h.acquired,false);
 assert.equal(h.log.filter(x=>x==='queue_action:ended').length,1);
});

test('late begin settles before lease release without constructing a child',async()=>{
 let settle!:()=>void;const queueGate=new Promise<void>(resolve=>{settle=resolve;});
 const h=harness({queueGate,gatedAction:'begin',operationTimeoutMs:20});
 let done=false;const work=h.runner.runOne();work.then(()=>{done=true;},()=>{done=true;});
 const rejection=assert.rejects(work,/OPERATION_TIMEOUT/);
 try{
  await new Promise(resolve=>setTimeout(resolve,70));assert.equal(done,false);
  assert.equal(h.child,undefined);assert.equal(h.log.includes('release'),false);
  await assert.rejects(h.runner.recover(),/RUNNER_BUSY/);
 }finally{settle();}
 await rejection;assert.equal(h.acquired,false);assert.equal(h.child,undefined);
 assert.equal((await h.queue.read()).current?.state,'preparing');
 await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
});
test('late completion persistence reaps child but cannot finish holder or release early',async()=>{
 let settle!:()=>void;const queueGate=new Promise<void>(resolve=>{settle=resolve;});
 const h=harness({queueGate,gatedAction:'ended',operationTimeoutMs:20});
 let done=false;const work=h.runner.runOne();work.then(()=>{done=true;},()=>{done=true;});
 const rejection=assert.rejects(work,/OPERATION_TIMEOUT/);
 try{
  await new Promise(resolve=>setTimeout(resolve,70));assert.ok(h.log.includes('reap'));
  assert.equal(done,false);assert.equal(h.log.includes('release'),false);
 }finally{settle();}
 await rejection;assert.equal((await h.queue.read()).current?.track.id,'b');
 assert.equal(h.log.filter(x=>x==='queue_action:ended').length,1);
 assert.equal(h.log.includes('audit:playback_completed'),false);
 await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
});
test('late release settles without retry and cannot become successful playback',async()=>{
 let settle!:()=>void;const releaseGate=new Promise<void>(resolve=>{settle=resolve;});
 const h=harness({releaseGate,operationTimeoutMs:20});
 let done=false;const work=h.runner.runOne();work.then(()=>{done=true;},()=>{done=true;});
 const rejection=assert.rejects(work,/OPERATION_TIMEOUT/);
 try{
  await new Promise(resolve=>setTimeout(resolve,70));assert.ok(h.log.includes('reap'));
  assert.equal(done,false);assert.equal(h.acquired,true);
  await assert.rejects(h.runner.recover(),/RUNNER_BUSY/);
 }finally{settle();}
 await rejection;assert.equal(h.releaseBindings.length,1);assert.equal(h.acquired,false);
 assert.equal(h.log.includes('audit:assistant_released'),false);
 await assert.rejects(h.runner.runOne(),/RUNNER_BLOCKED/);
});
test('recovery is exclusive while its persisted mutation is outstanding',async()=>{
 let settle!:()=>void;const queueGate=new Promise<void>(resolve=>{settle=resolve;});
 const h=harness({queueGate,gatedAction:'recover'});const recovery=h.runner.recover();
 try{
  await new Promise(resolve=>setImmediate(resolve));
  await assert.rejects(h.runner.runOne(),/RUNNER_BUSY/);
 }finally{settle();}
 await recovery;assert.equal(h.log.includes('acquire'),false);
});
test('late queue rejection is observed and exact lease is released only after settlement',async()=>{
 let reject!: (error:Error)=>void;const queueGate=new Promise<void>((_,no)=>{reject=no;});
 const h=harness({queueGate,gatedAction:'begin',operationTimeoutMs:20});
 const work=h.runner.runOne();const failure=assert.rejects(work,/OPERATION_TIMEOUT/);
 try{await new Promise(resolve=>setTimeout(resolve,70));assert.equal(h.log.includes('release'),false);}
 finally{reject(new Error('DB_UNAVAILABLE'));}
 await failure;assert.equal(h.releaseBindings.length,1);assert.equal(h.child,undefined);
});
test('failed native cleanup still retains holder until late queue mutation settles',async()=>{
 let settle!:()=>void;const queueGate=new Promise<void>(resolve=>{settle=resolve;});
 const h=harness({queueGate,gatedAction:'ended',cleanup:false,operationTimeoutMs:20});
 let done=false;const work=h.runner.runOne();work.then(()=>{done=true;},()=>{done=true;});
 const failure=assert.rejects(work,/CLEANUP_UNCERTAIN/);
 try{await new Promise(resolve=>setTimeout(resolve,70));assert.equal(done,false);assert.equal(h.acquired,true);}
 finally{settle();}
 await failure;assert.equal(h.log.includes('release'),false);
});
