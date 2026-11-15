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
