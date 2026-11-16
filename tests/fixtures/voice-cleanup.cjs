// Test-only framed transport fixture. No Telegram, credentials or media playback.
const {spawn}=require('node:child_process');
const mode=process.env.VOICE_TEST_MODE||'normal';
let input=Buffer.alloc(0),descendant;
const ready=mode==='descendant'?new Promise(resolve=>{
 descendant=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>process.exit(0));process.send('ready');setInterval(()=>{},1000);"],{stdio:['ignore','ignore','ignore','ipc']});
 descendant.once('message',resolve);
}):Promise.resolve();
if(mode==='stubborn')process.on('SIGTERM',()=>{});
process.stdin.on('data',async chunk=>{
 input=Buffer.concat([input,chunk]);
 while(input.length>=4&&input.length>=4+input.readUInt32BE(0)){
  const length=input.readUInt32BE(0),request=JSON.parse(input.subarray(4,4+length));input=input.subarray(4+length);
  await ready;
  const readOnly=['health','reconcile','renew'].includes(request.operation);
  const event={protocolVersion:1,eventId:request.requestId,requestId:request.requestId,sessionId:request.sessionId,leaseGeneration:request.assistantLeaseGeneration,sessionRevision:request.expectedRevision+(readOnly?0:1),eventType:readOnly?'heartbeat':request.operation==='leave'?'left':'playback_started',result:{state:request.operation==='leave'?'idle':'playing',pid:process.pid,descendantPid:descendant?.pid}};
  const body=Buffer.from(JSON.stringify(event)),header=Buffer.alloc(4);header.writeUInt32BE(body.length);process.stdout.write(Buffer.concat([header,body]));
 }
});
process.stdin.on('end',()=>{
 if(mode==='stubborn'){setInterval(()=>{},1000);return;}
 if(descendant){descendant.once('close',()=>process.exit(0));descendant.kill('SIGTERM');}
 else process.exit(0);
});
