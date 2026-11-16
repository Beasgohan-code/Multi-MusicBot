import {test} from 'node:test';
import assert from 'node:assert/strict';
import {probeProcessGroup,waitForProcessGroupExit} from '../../apps/bot-runtime/process-group.js';
test('group probe accepts only ESRCH as absence, never permission or unknown errors', {skip:process.platform==='win32'},()=>{
 assert.equal(probeProcessGroup(123,(target,signal)=>{assert.equal(target,-123);assert.equal(signal,0);return true;}),'present');
 for(const code of ['ESRCH','EPERM','EIO'])assert.equal(probeProcessGroup(123,()=>{throw Object.assign(new Error('sensitive OS text'),{code});}),code==='ESRCH'?'gone':'unknown');
});
test('invalid group identity is unknown and never probes an arbitrary process',()=>{
 let calls=0;for(const pid of [undefined,0,1,-1,NaN,1.5,2147483648])assert.equal(probeProcessGroup(pid,()=>{calls++;return true;}),'unknown');
 assert.equal(calls,0);
});
test('bounded group observation waits for disappearance, not just child exit',async()=>{
 let calls=0;assert.equal(await waitForProcessGroupExit(123,200,()=>++calls<3?'present':'gone'),true);assert.equal(calls,3);
});
test('persistent group exhausts deadline with no detached background probes',async()=>{
 let calls=0;assert.equal(await waitForProcessGroupExit(123,10,()=>{calls++;return 'present';}),false);
 const ended=calls;await new Promise(resolve=>setTimeout(resolve,35));assert.equal(calls,ended);
});
test('unknown group status fails immediately without retries',async()=>{
 let calls=0;assert.equal(await waitForProcessGroupExit(123,200,()=>{calls++;return 'unknown';}),false);assert.equal(calls,1);
});
test('invalid observation deadlines fail with a sanitized stable code',async()=>{
 for(const ms of [-1,NaN,0.5,5001])await assert.rejects(waitForProcessGroupExit(123,ms),/GROUP_WAIT_CONFIG_INVALID/);
});

test('zero deadline allows one immediate absence observation, never a retry',async()=>{
 let calls=0;assert.equal(await waitForProcessGroupExit(123,0,()=>{calls++;return 'gone';}),true);assert.equal(calls,1);
 calls=0;assert.equal(await waitForProcessGroupExit(123,0,()=>{calls++;return 'present';}),false);assert.equal(calls,1);
});
