import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AuthenticatedSupervisor} from '../../apps/bot-runtime/supervisor.js';
const binding={botId:'123',ownerId:'456',workerId:'w1',generation:1};
const token='x'.repeat(43);
function fixture(fail=false){
 const calls:string[]=[];
 const registry={async claim(t:string,w:string){assert.equal(t,token);assert.equal(w,'w1');calls.push('claim');return binding;},async heartbeat(){calls.push('heartbeat');if(fail)throw new Error('DB_DOWN');},async finish(_b:unknown,clean:boolean){calls.push(clean?'stopped':'quarantined');}};
 return {calls,supervisor:new AuthenticatedSupervisor(registry,{token,workerId:'w1',expectedBotId:'123',heartbeatMs:5,operationTimeoutMs:20})};
}
test('supervisor authenticates before work and drains before releasing worker',async()=>{
 const h=fixture();
 await h.supervisor.run(async(b,signal)=>{assert.equal(b.generation,1);assert.equal(signal.aborted,false);h.calls.push('work');return {clean:true};});
 assert.deepEqual(h.calls,['claim','heartbeat','work','stopped']);
});
test('registration/tenant mismatch and initial heartbeat failure never start playback',async()=>{
 const h=fixture(true);let started=false;
 await assert.rejects(h.supervisor.run(async()=>{started=true;return {clean:true};}),/SUPERVISOR_OWNERSHIP_LOST/);
 assert.equal(started,false);assert.equal(h.calls.at(-1),'quarantined');
});
test('graceful stop waits for cleanup; no automatic restart',async()=>{
 const h=fixture();let finished=false;
 const work=h.supervisor.run(async(_b,signal)=>{
  setTimeout(()=>h.supervisor.stop(),5);
  await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));
  await new Promise(resolve=>setTimeout(resolve,10));h.calls.push('reaped');finished=true;return {clean:true};
 });
 await work;
 assert.equal(finished,true);assert.ok(h.calls.indexOf('reaped')<h.calls.indexOf('stopped'));
});
test('uncertain cleanup and thrown runtime errors quarantine the worker',async()=>{
 const h=fixture();await assert.rejects(h.supervisor.run(async()=>({clean:false})),/SUPERVISOR_CLEANUP_UNCERTAIN/);assert.equal(h.calls.at(-1),'quarantined');
 const crash=fixture();await assert.rejects(crash.supervisor.run(async()=>{throw new Error('CHILD_CRASH');}),/CHILD_CRASH/);
 assert.equal(crash.calls.at(-1),'quarantined');
});
test('a late heartbeat cannot turn an ownership-loss shutdown into success',async()=>{
 let heartbeats=0,clean: boolean|undefined,drained=false;
 const registry={async claim(){return binding;},async heartbeat(){if(++heartbeats>1)await new Promise(resolve=>setTimeout(resolve,35));},async finish(_b:unknown,c:boolean){clean=c;assert.equal(drained,true);}};
 const supervisor=new AuthenticatedSupervisor(registry,{token,workerId:'w1',expectedBotId:'123',heartbeatMs:5,operationTimeoutMs:10});
 await assert.rejects(supervisor.run(async(_b,signal)=>{
  await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));drained=true;return {clean:true};
 }),/SUPERVISOR_OWNERSHIP_LOST/);
 assert.equal(clean,false);
});
test('wrong tenant from registration never starts work',async()=>{
 let worked=false,clean:boolean|undefined;
 const supervisor=new AuthenticatedSupervisor({async claim(){return {...binding,botId:'999'};},async heartbeat(){throw new Error('MUST_NOT_RENEW');},async finish(_b,c){clean=c;}},{token,workerId:'w1',expectedBotId:'123',heartbeatMs:5,operationTimeoutMs:10});
 await assert.rejects(supervisor.run(async()=>{worked=true;return {clean:true};}),/SUPERVISOR_TENANT_MISMATCH/);
 assert.equal(worked,false);assert.equal(clean,false);
});
test('database renewal outage aborts an active run before marking it quarantined',async()=>{
 const calls:string[]=[];let n=0;
 const supervisor=new AuthenticatedSupervisor({async claim(){return binding;},async heartbeat(){if(++n>1)throw new Error('DB_DOWN');},async finish(_b,clean){calls.push(clean?'stopped':'quarantined');}},{token,workerId:'w1',expectedBotId:'123',heartbeatMs:5,operationTimeoutMs:20});
 await assert.rejects(supervisor.run(async(_b,signal)=>{
  await new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve(),{once:true}));calls.push('drained');return {clean:true};
 }),/SUPERVISOR_OWNERSHIP_LOST/);
 assert.deepEqual(calls,['drained','quarantined']);
});
test('failure to persist cleanup cannot return supervisor success',async()=>{
 const supervisor=new AuthenticatedSupervisor({async claim(){return binding;},async heartbeat(){},async finish(){throw new Error('DB_DOWN');}},{token,workerId:'w1',expectedBotId:'123',heartbeatMs:5,operationTimeoutMs:20});
 await assert.rejects(supervisor.run(async()=>({clean:true})),/DB_DOWN/);
});
