import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
// @ts-expect-error deployment JS is deliberately unbundled for container startup
import {createHealthHandler} from '../../deploy/render/full-config.mjs';
async function withServer(handler:(req:IncomingMessage,res:ServerResponse)=>Promise<void>,work:(url:string)=>Promise<void>){
 const server=createServer((req,res)=>{void handler(req,res).catch(()=>{res.writeHead(599).end('handler rejected');});});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address&&typeof address==='object');
 try{await work(`http://127.0.0.1:${address.port}`);}
 finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
}
test('health endpoint reports timely readiness without caching and ignores unknown paths',async()=>{
 let calls=0;const handler=createHealthHandler(()=>false,async()=>{calls++;return true;});
 await withServer(handler,async base=>{
  const good=await fetch(base+'/health');assert.equal(good.status,200);assert.equal(await good.text(),'ok');assert.equal(good.headers.get('cache-control'),'no-store');
  const missing=await fetch(base+'/missing');assert.equal(missing.status,404);await missing.text();assert.equal(calls,1);
 });
});
test('in-flight healthy result cannot restore readiness after shutdown starts',async()=>{
 let stopping=false,release!:(value:boolean)=>void,entered!:()=>void;
 const blocked=new Promise<boolean>(resolve=>{release=resolve;});const started=new Promise<void>(resolve=>{entered=resolve;});
 const handler=createHealthHandler(()=>stopping,()=>{entered();return blocked;});
 await withServer(handler,async base=>{
  const response=fetch(base+'/health');await started;stopping=true;release(true);
  const late=await response;assert.equal(late.status,503);assert.equal(await late.text(),'not ready');
 });
});
test('shutdown health checks do not admit new downstream probes',async()=>{
 let calls=0;const handler=createHealthHandler(()=>true,async()=>{calls++;return true;});
 await withServer(handler,async base=>{const response=await fetch(base+'/health');assert.equal(response.status,503);await response.text();assert.equal(calls,0);});
});
test('failed or rejected downstream probes fail closed without exposing raw errors',async()=>{
 for(const check of [async()=>false,async()=>{throw new Error('sensitive-downstream-error');}]){
  await withServer(createHealthHandler(()=>false,check),async base=>{
   const response=await fetch(base+'/health');assert.equal(response.status,503);assert.equal(await response.text(),'not ready');
  });
 }
});
