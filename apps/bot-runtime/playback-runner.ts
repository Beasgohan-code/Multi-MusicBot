import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { Action, QueueState, Source } from '../../packages/queue/state.js';
import type { VoiceRequest } from '../../packages/shared/protocol.js';
import type { VoiceEvent } from './voice-process.js';
import { applyNativeEvent } from './queue-events.js';
interface QueueRepository { read():Promise<QueueState>; apply(revision:number,action:Action):Promise<QueueState> }
interface Leases {
 acquire(assistantId:string,holder:string,botId:string,chatId:string,ttl:number):Promise<{generation:number}>;
 renew(assistantId:string,holder:string,generation:number,ttl:number):Promise<{generation:number}>;
 releaseAfterCleanup(assistantId:string,holder:string,generation:number):Promise<void>;
}
export interface PlaybackChild {
 request(request:VoiceRequest):Promise<VoiceEvent>;
 on(event:string,listener:(value:any)=>void):this;
 shutdown():Promise<{clean:boolean}>;
}
export interface ChildBinding {botId:string;chatId:string;source:Source;validForMs:number}
export interface RunnerEvent {type:string;botId:string;chatId:string;sessionId:string;generation:number}
interface Options {assistantId:string;holderId:string;leaseTtlMs:number;renewEveryMs:number;operationTimeoutMs:number}
/** One trusted queue binding per runner. Errors block reuse until explicit reconciliation. */
export class PlaybackRunner {
 private running=false;
 private stopping=false;
 private blocked=false;
 private cancel:(()=>void)|undefined;
 constructor(private readonly queue:QueueRepository,private readonly leases:Leases,private readonly factory:(b:ChildBinding)=>PlaybackChild,private readonly audit:(event:RunnerEvent)=>Promise<void>,private readonly options:Options){
  if(options.leaseTtlMs<1000||options.leaseTtlMs>60000||options.renewEveryMs<1||options.renewEveryMs>=options.leaseTtlMs/2||options.operationTimeoutMs<1||options.operationTimeoutMs>=options.leaseTtlMs/2)throw new Error('RUNNER_CONFIG_INVALID');
 }
 private async bounded<T>(work:Promise<T>):Promise<T>{
  let timer:NodeJS.Timeout|undefined;
  try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('OPERATION_TIMEOUT')),this.options.operationTimeoutMs);})]);}
  finally{if(timer)clearTimeout(timer);}
 }
 private async shutdownChild(child:PlaybackChild,record:(type:string)=>Promise<unknown>):Promise<void>{
  const shutdown=child.shutdown();
  let cleanup:{clean:boolean};
  try{cleanup=await this.bounded(shutdown);}
  catch(error){
   // A Promise timeout cannot cancel native teardown. Keep runOne pending so
   // its supervisor cannot finish/restart the holder before actual settlement.
   // Even late clean completion does not retroactively authorize lease reuse.
   this.blocked=true;
   await record('cleanup_uncertain').catch(()=>{});
   await shutdown.catch(()=>{});
   throw error;
  }
  await record('child_exited');
  if(!cleanup.clean){this.blocked=true;await record('cleanup_uncertain').catch(()=>{});throw new Error('CLEANUP_UNCERTAIN');}
 }
 /** Signal only; runOne must finish cleanup before the caller may dispose/restart. */
 stop():void{this.stopping=true;this.cancel?.();}
 async recover():Promise<void>{
  if(this.running)throw new Error('RUNNER_BUSY');
  const s=await this.queue.read();
  await this.queue.apply(s.revision,{type:'recover'});
  // Metadata recovery is not cleanup evidence. Never clear a blocked runner here;
  // ownership reconciliation must independently prove cleanup before replacement.
 }
 async runOne():Promise<'completed'|'skipped'|'interrupted'|'idle'>{
  if(this.stopping)throw new Error('RUNNER_STOPPED');
  if(this.blocked)throw new Error('RUNNER_BLOCKED');
  if(this.running)throw new Error('RUNNER_BUSY');
  this.running=true;
  const o=this.options;
  let child:PlaybackChild|undefined, generation:number|undefined, timer:NodeJS.Timeout|undefined, renewWork:Promise<void>|undefined;
  let source:Source|undefined, completed=false, outcome:'completed'|'skipped'|'interrupted'='interrupted';
  let superseded:'skipped'|'interrupted'|undefined;
  let pendingLeaseRenewal:Promise<{generation:number}>|undefined,renewalFailed=false;
  let shutdownWork:Promise<void>|undefined;
  let state=await this.queue.read().catch(e=>{this.running=false;throw e;});
  const sessionId=randomUUID();
  const record=async(type:string)=>this.bounded(this.audit({type,botId:state.botId,chatId:state.chatId,sessionId,generation:generation??0}));
  const shutdown=():Promise<void>=>child?(shutdownWork??=this.shutdownChild(child,record)):Promise.resolve();
  let terminalResolve:(e:VoiceEvent|null)=>void=()=>{};
  let terminalSettled=false;
  let cancelled:boolean=this.stopping;
  const terminal=new Promise<VoiceEvent|null>(resolve=>{terminalResolve=e=>{if(!terminalSettled){terminalSettled=true;resolve(e);}};});
  this.cancel=()=>{cancelled=true;terminalResolve(null);};
  try{
   if(cancelled)throw new Error('RUNNER_STOPPED');
   if(state.current?.source)throw new Error('RECOVERY_REQUIRED');
   if(!state.current&&!state.upcoming.length)return 'idle';
   const acquiredAt=performance.now();
   const acquisition=this.leases.acquire(o.assistantId,o.holderId,state.botId,state.chatId,o.leaseTtlMs);
   try{generation=(await this.bounded(acquisition)).generation;}
   catch(error){
    // A deadline does not cancel Mongo. Keep the holder busy until this exact
    // acquisition settles; never retry it or start native playback from a late result.
    this.blocked=true;
    try{generation=(await acquisition).generation;}catch{ /* Unknown DB outcome remains for reconciliation. */ }
    // A known late acquisition had no child: finally may compensate only its
    // exact holder/generation. A rejected/unknown outcome must never claim release.
    throw error;
   }
   await record('assistant_acquired');
   source={sessionId,generation,requestId:randomUUID()};
   state=await this.bounded(this.queue.apply(state.revision,{type:'begin',source}));
   const validForMs=Math.floor(o.leaseTtlMs-(performance.now()-acquiredAt)-o.operationTimeoutMs);
   if(validForMs<100)throw new Error('LEASE_BUDGET_EXHAUSTED');
   if(cancelled)throw new Error('RUNNER_STOPPED');
   child=this.factory({botId:state.botId,chatId:state.chatId,source,validForMs});
   await record('child_started');
   child.on('voiceEvent',(event:VoiceEvent)=>{
    if(event.sessionId===source!.sessionId&&event.leaseGeneration===source!.generation&&event.requestId===source!.requestId&&event.result.playbackRequestId===source!.requestId&&['media_ended','disconnected'].includes(event.eventType))terminalResolve(event);
   });
   child.on('voiceClosed',()=>terminalResolve(null));
   let nativeRevision=0;
   const request=(operation:VoiceRequest['operation'],payload:VoiceRequest['payload']={},id:string=randomUUID())=>child!.request({protocolVersion:1,requestId:id,botId:state.botId,chatId:state.chatId,sessionId,assistantLeaseGeneration:generation!,expectedRevision:nativeRevision,operation,payload});
   if(cancelled)throw new Error('RUNNER_STOPPED');
   const started=await this.bounded(request('start-local-media',{mediaHandle:state.current!.track.mediaHandle},source.requestId));
   if(started.eventType!=='playback_started')throw new Error('PLAYBACK_START_FAILED');
   if(cancelled)throw new Error('RUNNER_STOPPED');
   nativeRevision=started.sessionRevision;
   state=await this.bounded(this.queue.apply(state.revision,{type:'confirmed',source}));
   await record('playback_started');
   let lastRenewed=performance.now();
   const renew=async()=>{
    try{
     const observed=await this.bounded(this.queue.read());
     if(observed.current?.source?.requestId!==source!.requestId){
      superseded=observed.current?.state==='preparing'?'skipped':'interrupted';terminalResolve(null);return;
     }
     if(observed.intent?.type==='pause'||observed.intent?.type==='resume'){
      const control=observed.intent.type;
      const ack=await this.bounded(request(control));
      if(ack.eventType!==(control==='pause'?'paused':'resumed'))throw new Error('CONTROL_FAILED');
      nativeRevision=ack.sessionRevision;
      await this.bounded(this.queue.apply(observed.revision,{type:'control-confirmed',source:source!,control}));
      await record(control==='pause'?'playback_paused':'playback_resumed');
     }
     if(terminalSettled||performance.now()-lastRenewed<o.renewEveryMs)return;
     const began=performance.now();
     pendingLeaseRenewal=this.leases.renew(o.assistantId,o.holderId,generation!,o.leaseTtlMs);
     try{
      const renewed=await this.bounded(pendingLeaseRenewal);
      if(renewed.generation!==generation)throw new Error('LEASE_LOST');
     }catch(error){renewalFailed=true;this.blocked=true;throw error;}
     if(terminalSettled)return;
     const leaseMs=Math.floor(o.leaseTtlMs-(performance.now()-began)-o.operationTimeoutMs);
     if(leaseMs<100)throw new Error('LEASE_BUDGET_EXHAUSTED');
     const response=await this.bounded(request('renew',{leaseMs}));
     if(response.eventType!=='heartbeat')throw new Error('LEASE_RENEW_FAILED');
     lastRenewed=performance.now();
     await record('assistant_renewed');
    }catch{terminalResolve(null);}
   };
   const schedule=()=>{timer=setTimeout(()=>{renewWork=renew().finally(()=>{if(!terminalSettled)schedule();});},Math.min(o.renewEveryMs,250));};schedule();
   const end=await terminal;
   if(timer)clearTimeout(timer);
   if(renewWork)await renewWork;
   // Stop native execution before any queue persistence when DB renewal is uncertain.
   if(renewalFailed)await shutdown();
   if(end&&!renewalFailed){completed=end.eventType==='media_ended';await this.bounded(applyNativeEvent(this.queue,end));outcome=completed?'completed':'interrupted';}
   else{
    if(superseded)outcome=superseded;
    const latest=await this.bounded(this.queue.read());
    if(latest.current?.source?.requestId===source.requestId)await this.bounded(this.queue.apply(latest.revision,{type:'disconnected',source}));
   }
   await record(completed?'playback_completed':'playback_interrupted');
   if(completed)await record('queue_advanced');
   return outcome;
  }catch(error){this.blocked=true;await record('playback_failed').catch(()=>{});throw error;}
  finally{
   terminalSettled=true;this.cancel=undefined;if(timer)clearTimeout(timer);
   if(renewWork)await renewWork;
   try{
    if(generation!==undefined){
     if(child){
      await shutdown();
     }
     // Native teardown must precede waiting for a delayed Mongo renewal.
     // Release must follow settlement, even if renewal rejected with an unknown DB outcome.
     if(pendingLeaseRenewal)await pendingLeaseRenewal.catch(()=>{});
     // No child was constructed, or native leave + reap was confirmed.
     await this.bounded(this.leases.releaseAfterCleanup(o.assistantId,o.holderId,generation));
     await record('assistant_released');
    }
   }catch(error){this.blocked=true;throw error;}
   finally{
    // Even failed teardown cannot let the supervisor finish while Mongo can still mutate ownership.
    if(pendingLeaseRenewal)await pendingLeaseRenewal.catch(()=>{});
    this.running=false;
   }
  }
 }
}
