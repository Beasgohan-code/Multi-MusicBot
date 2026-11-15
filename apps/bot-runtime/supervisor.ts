import type {WorkerBinding} from '../../packages/database/workers.js';
interface Registry {
 claim(token:string,workerId:string):Promise<WorkerBinding>;
 heartbeat(binding:WorkerBinding,ready:boolean,token:string):Promise<void>;
 finish(binding:WorkerBinding,clean:boolean,token:string):Promise<void>;
}
interface Options {token:string;workerId:string;expectedBotId:string;heartbeatMs:number;operationTimeoutMs:number}
/** Internal authenticated execution guard. No automatic restart or expiry takeover.
 * Work must abort/drain and return trusted cleanup evidence before the worker is stopped.
 */
export class AuthenticatedSupervisor {
 private readonly abort=new AbortController();
 private used=false;
 constructor(private readonly registry:Registry,private readonly options:Options){
  if(!/^[A-Za-z0-9_-]{43,128}$/.test(options.token)||!Number.isSafeInteger(options.heartbeatMs)||options.heartbeatMs<1||!Number.isSafeInteger(options.operationTimeoutMs)||options.operationTimeoutMs<1||options.heartbeatMs+options.operationTimeoutMs>=15000)throw new Error('SUPERVISOR_CONFIG_INVALID');
 }
 stop():void{this.abort.abort();}
 private async heartbeat(binding:WorkerBinding):Promise<void>{
  let timer:NodeJS.Timeout|undefined;
  try{
   await Promise.race([this.registry.heartbeat(binding,true,this.options.token),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('SUPERVISOR_OWNERSHIP_LOST')),this.options.operationTimeoutMs);})]);
  }finally{if(timer)clearTimeout(timer);}
 }
 async run(work:(binding:WorkerBinding,signal:AbortSignal)=>Promise<{clean:boolean}>):Promise<void>{
  if(this.used)throw new Error('SUPERVISOR_ALREADY_USED');this.used=true;
  if(this.abort.signal.aborted)throw new Error('SUPERVISOR_STOPPED');
  // Do not race claim against a timeout: a late successful claim must still be fenced/finished.
  // Mongo connection/socket deadlines bound the production transport.
  const binding=await this.registry.claim(this.options.token,this.options.workerId);
  let clean=false,lost=false,timer:NodeJS.Timeout|undefined,inFlight:Promise<void>|undefined;
  try{
   if(binding.botId!==this.options.expectedBotId)throw new Error('SUPERVISOR_TENANT_MISMATCH');
   try{await this.heartbeat(binding);}catch{lost=true;throw new Error('SUPERVISOR_OWNERSHIP_LOST');}
   const schedule=()=>{timer=setTimeout(()=>{
    inFlight=this.heartbeat(binding).catch(()=>{lost=true;this.abort.abort();}).finally(()=>{if(!this.abort.signal.aborted)schedule();});
   },this.options.heartbeatMs);};
   if(this.abort.signal.aborted)return;
   schedule();
   const result=await work(binding,this.abort.signal);
   clean=result.clean===true;
  }finally{
   this.abort.abort();if(timer)clearTimeout(timer);
   if(inFlight)await inFlight;
   // Ownership loss is conservative quarantine even if native teardown later succeeds.
   await this.registry.finish(binding,clean&&!lost,this.options.token);
  }
  if(lost)throw new Error('SUPERVISOR_OWNERSHIP_LOST');
  if(!clean)throw new Error('SUPERVISOR_CLEANUP_UNCERTAIN');
 }
}
