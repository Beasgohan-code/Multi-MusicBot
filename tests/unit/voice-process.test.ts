import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VoiceProcess } from '../../apps/bot-runtime/voice-process.js';
const request = { protocolVersion: 1 as const, requestId: 'r1', botId: '123', chatId: '-1001', sessionId: 's1', assistantLeaseGeneration: 4, expectedRevision: 0, operation: 'health' as const, payload: {} };
// Transport harness only, never used by production and does not claim voice playback.
const responder = `process.stdin.once('data', b => { const r=JSON.parse(b.subarray(4).toString()); const e={protocolVersion:1,eventId:'e1',requestId:r.requestId,sessionId:r.sessionId,leaseGeneration:r.assistantLeaseGeneration,sessionRevision:0,eventType:'heartbeat',result:{state:'idle'}}; const p=Buffer.from(JSON.stringify(e)); const h=Buffer.alloc(4);h.writeUInt32BE(p.length);process.stdout.write(Buffer.concat([h,p])); });`;
test('voice child correlates validated response and terminates on close', async () => {
  const voice = new VoiceProcess(process.execPath, ['-e', responder], {}, 1000);
  try { assert.equal((await voice.request(request)).eventType, 'heartbeat'); }
  finally { await voice.close(); }
});
test('voice child timeout and exit reject pending commands, never simulate success', async () => {
  const voice = new VoiceProcess(process.execPath, ['-e', 'process.stdin.resume()'], {}, 60);
  await assert.rejects(voice.request(request), /VOICE_TIMEOUT/); await voice.close();
  const crash = new VoiceProcess(process.execPath, ['-e', 'process.exit(3)'], {}, 1000);
  await assert.rejects(crash.request(request), /VOICE_EXITED/); await crash.close();
});
test('voice child rejects unsolicited wrong session result', async () => {
  const voice = new VoiceProcess(process.execPath, ['-e', responder.replace('sessionId:r.sessionId', "sessionId:'other'")], {}, 1000);
  await assert.rejects(voice.request(request), /VOICE_PROTOCOL_INVALID/); await voice.close();
});
test('heartbeat cannot complete a playback command and accepted alone times out', async () => {
  const voice = new VoiceProcess(process.execPath, ['-e', responder], {}, 1000);
  try { await assert.rejects(voice.request({ ...request, operation: 'start-local-media', payload: { mediaHandle: 'a' } }), /VOICE_PROTOCOL_INVALID/); }
  finally { await voice.close(); }
  const accepted = new VoiceProcess(process.execPath, ['-e', responder.replace("eventType:'heartbeat'", "eventType:'accepted'") + 'process.stdin.resume();'], {}, 100);
  await assert.rejects(accepted.request(request), /VOICE_TIMEOUT/); await accepted.close();
});
test('native completion is delivered without pending command and deduplicated', async () => {
  const native = `setTimeout(()=>{ const n={...e,eventId:'end1',eventType:'media_ended',sessionRevision:2,result:{state:'ended',playbackRequestId:r.requestId}}; const b=Buffer.from(JSON.stringify(n)),h=Buffer.alloc(4);h.writeUInt32BE(b.length); const f=Buffer.concat([h,b]);process.stdout.write(Buffer.concat([f,f]));},10);`;
  const voice = new VoiceProcess(process.execPath, ['-e', responder.replace("eventType:'heartbeat'", "eventType:'playback_started'").replace('sessionRevision:0', 'sessionRevision:1').replace(' });', native + ' });')], {}, 1000);
  const seen: string[] = [];
  try {
    voice.on('voiceEvent', e => seen.push(e.eventId));
    await voice.request({ ...request, operation: 'start-local-media', payload: { mediaHandle: 'a' } });
    await new Promise(resolve => setTimeout(resolve, 80));
    assert.deepEqual(seen, ['end1']);
  } finally { await voice.close(); }
});
test('shutdown requires native leave acknowledgement plus normal child exit',async()=>{
 const program=`let b=Buffer.alloc(0);process.stdin.on('data',c=>{b=Buffer.concat([b,c]);while(b.length>=4&&b.length>=4+b.readUInt32BE(0)){let n=b.readUInt32BE(0),r=JSON.parse(b.subarray(4,4+n));b=b.subarray(4+n);let e={protocolVersion:1,eventId:r.requestId,requestId:r.requestId,sessionId:r.sessionId,leaseGeneration:r.assistantLeaseGeneration,sessionRevision:r.expectedRevision+1,eventType:r.operation==='leave'?'left':'playback_started',result:{state:r.operation==='leave'?'idle':'playing'}};let p=Buffer.from(JSON.stringify(e)),h=Buffer.alloc(4);h.writeUInt32BE(p.length);process.stdout.write(Buffer.concat([h,p]));}});process.stdin.on('end',()=>process.exit(0));`;
 const voice=new VoiceProcess(process.execPath,['-e',program],{},1000);
 try{
  await voice.request({...request,operation:'start-local-media',payload:{mediaHandle:'a'}});
  assert.deepEqual(await voice.shutdown(),{clean:true});
 }finally{await voice.close();}
});
test('unexpected exit notifies controller even without pending command',async()=>{
 const voice=new VoiceProcess(process.execPath,['-e',responder+'setTimeout(()=>process.exit(3),100);'],{},1000);
 const closed=new Promise<string>(resolve=>voice.once('voiceClosed',resolve));
 try{await voice.request(request);assert.equal(await closed,'VOICE_EXITED');assert.deepEqual(await voice.shutdown(),{clean:false});}
 finally{await voice.close();}
});

test('concurrent native shutdown callers share one leave/reap result',async()=>{
 const voice=new VoiceProcess(process.execPath,['tests/fixtures/voice-cleanup.cjs'],{},1000);
 try{
  await voice.request({...request,operation:'start-local-media',payload:{mediaHandle:'a'}});
  const [first,second]=await Promise.all([voice.shutdown(),voice.shutdown()]);
  assert.deepEqual(first,{clean:true});assert.deepEqual(second,first);
 }finally{await voice.close();}
});
test('repeated shutdown preserves completed cleanup evidence without sending another leave',async()=>{
 const voice=new VoiceProcess(process.execPath,['tests/fixtures/voice-cleanup.cjs'],{},1000);
 try{
  await voice.request({...request,operation:'start-local-media',payload:{mediaHandle:'a'}});
  const first=await voice.shutdown();assert.deepEqual(first,{clean:true});
  assert.deepEqual(await voice.shutdown(),first);
 }finally{await voice.close();}
});
test('concurrent close callers share the exact process reap operation',async()=>{
 const voice=new VoiceProcess(process.execPath,['tests/fixtures/voice-cleanup.cjs'],{},1000);
 await voice.request(request);
 const first=voice.close(),second=voice.close();
 try{assert.equal(first,second);}finally{await Promise.all([first,second]);}
});
function assertProcessGone(pid:unknown):void {
 assert.equal(typeof pid,'number');
 assert.throws(()=>process.kill(pid as number,0),(error:unknown)=>(error as NodeJS.ErrnoException).code==='ESRCH');
}
test('normal native shutdown waits for same-group descendant reaping', {skip:process.platform==='win32'},async()=>{
 const voice=new VoiceProcess(process.execPath,['tests/fixtures/voice-cleanup.cjs'],{VOICE_TEST_MODE:'descendant'},1000);
 try{
  const started=await voice.request({...request,operation:'start-local-media',payload:{mediaHandle:'a'}});
  assert.deepEqual(await voice.shutdown(),{clean:true});
  assertProcessGone(started.result.pid);assertProcessGone(started.result.descendantPid);assertProcessGone(-(started.result.pid as number));
 }finally{await voice.close();}
});
test('SIGKILL escalation reaps a SIGTERM-resistant child but cannot authorize assistant release', {skip:process.platform==='win32'},async()=>{
 const {PlaybackRunner}=await import('../../apps/bot-runtime/playback-runner.js');
 const {emptyQueue,transition}=await import('../../packages/queue/state.js');
 let state=transition(emptyQueue('123','-1001'),{type:'enqueue',track:{id:'a',title:'a',mediaHandle:'a'}});
 let ready!:()=>void;const started=new Promise<void>(resolve=>{ready=resolve;});
 let acquired=false,releases=0;let voice:VoiceProcess|undefined,pid:unknown;
 const runner=new PlaybackRunner({async read(){return structuredClone(state);},async apply(revision,action){
  assert.equal(revision,state.revision);state=transition(state,action);if(action.type==='confirmed')ready();return structuredClone(state);
 }},{async acquire(){acquired=true;return {generation:1};},async renew(){return {generation:1};},async releaseAfterCleanup(){releases++;acquired=false;}},()=>{
  voice=new VoiceProcess(process.execPath,['tests/fixtures/voice-cleanup.cjs'],{VOICE_TEST_MODE:'stubborn'},1000);
  const send=voice.request.bind(voice);
  voice.request=async message=>{const response=await send(message);if(message.operation==='start-local-media')pid=response.result.pid;return response;};
  return voice;
 },async()=>{},{assistantId:'a',holderId:'w',leaseTtlMs:10000,renewEveryMs:1000,operationTimeoutMs:3000});
 const work=runner.runOne();const failure=assert.rejects(work,/CLEANUP_UNCERTAIN/);
 try{
  await started;runner.stop();await failure;
  assert.equal(acquired,true);assert.equal(releases,0);assertProcessGone(pid);assertProcessGone(-(pid as number));
  assert.deepEqual(await voice!.shutdown(),{clean:false});
  await assert.rejects(voice!.request(request),/VOICE_CLOSED/);
 }finally{runner.stop();if(voice)await voice.close();await work.catch(()=>{});}
});
test('close escalates after ignored SIGTERM and awaits immediate-child reap', {skip:process.platform==='win32'},async()=>{
 const voice=new VoiceProcess(process.execPath,['tests/fixtures/voice-cleanup.cjs'],{VOICE_TEST_MODE:'stubborn'},1000);
 const observed=await voice.request(request);let done=false;
 const closing=voice.close();closing.then(()=>{done=true;},()=>{done=true;});
 try{
  await new Promise(resolve=>setTimeout(resolve,75));
  assert.equal(done,false);assert.doesNotThrow(()=>process.kill(observed.result.pid as number,0));
  await closing;assertProcessGone(observed.result.pid);assertProcessGone(-(observed.result.pid as number));
  assert.deepEqual(await voice.shutdown(),{clean:false});assert.equal(voice.close(),closing);
 }finally{await closing;}
});
test('shutdown waits for delayed group absence after immediate-child reap', {skip:process.platform==='win32'},async(t)=>{
 const original=process.kill.bind(process);let probes=0;
 const kill=t.mock.method(process,'kill',(pid:number,signal?:NodeJS.Signals|number)=>{
  if(signal===0&&pid<0&&++probes<3)return true;
  return original(pid,signal);
 });
 const voice=new VoiceProcess(process.execPath,['tests/fixtures/voice-cleanup.cjs'],{},1000);
 try{
  await voice.request({...request,operation:'start-local-media',payload:{mediaHandle:'a'}});
  assert.deepEqual(await voice.shutdown(),{clean:true});assert.ok(probes>=3);
 }finally{await voice.close();kill.mock.restore();}
});
test('non-ESRCH signal error cannot be silently treated as successful cleanup', {skip:process.platform==='win32'},async(t)=>{
 const original=process.kill.bind(process);
 const kill=t.mock.method(process,'kill',(pid:number,signal?:NodeJS.Signals|number)=>{
  if(signal==='SIGTERM')throw Object.assign(new Error('must-not-leak'),{code:'EPERM'});
  return original(pid,signal);
 });
 const voice=new VoiceProcess(process.execPath,['tests/fixtures/voice-cleanup.cjs'],{},1000);
 try{
  await voice.request({...request,operation:'start-local-media',payload:{mediaHandle:'a'}});
  assert.deepEqual(await voice.shutdown(),{clean:false});assert.deepEqual(await voice.shutdown(),{clean:false});
 }finally{await voice.close();kill.mock.restore();}
});
test('unknown group probe fails closed and cached cleanup does not re-probe the old identity', {skip:process.platform==='win32'},async(t)=>{
 const original=process.kill.bind(process);let probes=0;
 const kill=t.mock.method(process,'kill',(pid:number,signal?:NodeJS.Signals|number)=>{
  if(signal===0){probes++;throw Object.assign(new Error('OS details excluded'),{code:'EPERM'});}
  return original(pid,signal);
 });
 const voice=new VoiceProcess(process.execPath,['tests/fixtures/voice-cleanup.cjs'],{},1000);
 try{
  await voice.request({...request,operation:'start-local-media',payload:{mediaHandle:'a'}});
  assert.deepEqual(await voice.shutdown(),{clean:false});assert.equal(probes,1);
  assert.deepEqual(await voice.shutdown(),{clean:false});await voice.close();assert.equal(probes,1);
 }finally{await voice.close();kill.mock.restore();}
});
test('spawn failure has no group identity and never supplies clean shutdown evidence',async()=>{
 const voice=new VoiceProcess('multimusicbot-nonexistent-executable-for-test',[],{},1000);
 try{await assert.rejects(voice.request(request),/VOICE_EXITED/);await voice.close();assert.deepEqual(await voice.shutdown(),{clean:false});}
 finally{await voice.close();}
});
test('persistent post-reap group reaches bounded uncertainty instead of clean success', {skip:process.platform==='win32'},async(t)=>{
 const original=process.kill.bind(process);let probes=0,done=false;
 const kill=t.mock.method(process,'kill',(pid:number,signal?:NodeJS.Signals|number)=>{
  if(signal===0){probes++;return true;}return original(pid,signal);
 });
 const voice=new VoiceProcess(process.execPath,['tests/fixtures/voice-cleanup.cjs'],{},1000);
 let cleanup:Promise<{clean:boolean}>|undefined;
 try{
  await voice.request({...request,operation:'start-local-media',payload:{mediaHandle:'a'}});
  cleanup=voice.shutdown();cleanup.then(()=>{done=true;},()=>{done=true;});
  await new Promise(resolve=>setTimeout(resolve,40));assert.equal(done,false);
  assert.deepEqual(await cleanup,{clean:false});assert.ok(probes>0);
  const settled=probes;assert.deepEqual(await voice.shutdown(),{clean:false});await voice.close();assert.equal(probes,settled);
 }finally{if(cleanup)await cleanup;await voice.close();kill.mock.restore();}
});
