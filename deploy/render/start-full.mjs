import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync} from 'node:fs';
import {fullEnvironment,servicesReady} from './full-config.mjs';
let env;
try{env=fullEnvironment(process.env);}catch(error){console.error(error.message);process.exit(1);}
const port=env.PORT||'10000';
if(['3000','3001','3067'].includes(port)){console.error('DEPLOY_CONFIG_INVALID: PORT conflicts with internal service');process.exit(1);}
writeFileSync('/tmp/playeon-nginx.conf',readFileSync('/opt/deploy/full-nginx.conf','utf8').replace('__PORT__',port));
const children=new Set();let stopping=false,exitCode=0,killTimer;
const health=createServer(async(req,res)=>{
 if(req.url!=='/health'){res.writeHead(404).end();return;}
 const ready=!stopping&&await servicesReady();
 res.writeHead(ready?200:503,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end(ready?'ok':'not ready');
});
function finish(){if(stopping&&children.size===0){clearTimeout(killTimer);health.close();process.exitCode=exitCode;}}
function stop(code){
 if(stopping)return;stopping=true;exitCode=code;
 for(const child of children)child.kill('SIGTERM');
 killTimer=setTimeout(()=>{for(const child of children)child.kill('SIGKILL');},10000);
 finish();
}
function launch(name,command,args,cwd){
 const child=spawn(command,args,{cwd,env,stdio:'inherit'});children.add(child);
 child.once('error',()=>{console.error(`SERVICE_START_FAILED: ${name}`);stop(1);});
 child.once('close',()=>{children.delete(child);if(!stopping){console.error(`SERVICE_EXITED: ${name}`);stop(1);}finish();});
}
process.once('SIGTERM',()=>stop(0));process.once('SIGINT',()=>stop(0));
health.once('error',()=>{console.error('HEALTH_SERVER_FAILED');stop(1);});
console.info('APPLICATION_STARTING: combined bot + WebApp; /health requires both services.');
health.listen(3001,'127.0.0.1',()=>{
 if(stopping)return;
 launch('bot','node',['--import','tsx','src/index.ts'],'/app/bot');
 launch('web','node',['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','3000'],'/app/web');
 launch('gateway','nginx',['-c','/tmp/playeon-nginx.conf','-g','daemon off;'],'/app');
});
