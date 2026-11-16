import {performance} from 'node:perf_hooks';
import {setTimeout as delay} from 'node:timers/promises';
export type ProcessGroupState='present'|'gone'|'unknown';
type Kill=(pid:number,signal:number)=>boolean;
/** POSIX group identity only; ESRCH is the sole positive absence observation. */
export function probeProcessGroup(pid:number|undefined,kill:Kill=(target,signal)=>process.kill(target,signal)):ProcessGroupState {
 if(process.platform==='win32'||!Number.isSafeInteger(pid)||pid===undefined||pid<2||pid>2147483647)return 'unknown';
 try{kill(-pid,0);return 'present';}
 catch(error){return (error as NodeJS.ErrnoException|null)?.code==='ESRCH'?'gone':'unknown';}
}
/** Bounded post-reap observation, not cancellation/reaping or a host cleanup attestation.
 * Synchronous probes cannot mutate playback; no background work survives this wait.
 */
export async function waitForProcessGroupExit(pid:number|undefined,timeoutMs=2000,probe:(pid:number|undefined)=>ProcessGroupState=probeProcessGroup):Promise<boolean>{
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<0||timeoutMs>5000)throw new Error('GROUP_WAIT_CONFIG_INVALID');
 const deadline=performance.now()+timeoutMs;
 let first=true;
 while(first||performance.now()<deadline){
  first=false;
  const state=probe(pid);
  if(state==='gone')return true;
  if(state==='unknown')return false;
  const remaining=deadline-performance.now();
  if(remaining<=0)return false;
  await delay(Math.min(25,remaining));
 }
 return false;
}
