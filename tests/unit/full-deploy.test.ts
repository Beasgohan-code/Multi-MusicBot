import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
// @ts-expect-error runtime deployment module intentionally has no generated declaration
import {fullEnvironment,servicesReady} from '../../deploy/render/full-config.mjs';
const env={NODE_ENV:'production',PUBLIC_APP_URL:'https://my-music.onrender.com',BOT_USERNAME:'MyMusicBot',API_ID:'12345',API_HASH:'a'.repeat(32),BOT_TOKEN:'12345:'+ 'a'.repeat(35),ROOM_JWT_SECRET:'a'.repeat(64),MONGO_URI:'mongodb://db.example.test/music',MONGO_DB:'music',REDIS_URL:'rediss://cache.example.test:6379',SESSION_NAME:'/var/data/playeon-session'};
test('single-container configuration derives all public bot/web bindings from one origin',()=>{
 const derived=fullEnvironment(env);
 for(const key of ['ROOM_PUBLIC_URL','WEB_PUBLIC_URL','NEXT_PUBLIC_ROOM_WS_URL'])assert.equal(derived[key],env.PUBLIC_APP_URL);
 assert.equal(derived.NEXT_PUBLIC_BOT_USERNAME,'MyMusicBot');assert.equal(derived.TELEGRAM_BOT_ID,'12345');assert.equal(derived.ROOM_WS_PORT,'3067');
});
test('full-container invalid configuration fails without exposing values or accepting identity overrides',()=>{
 for(const patch of [{PUBLIC_APP_URL:'http://localhost:3067'},{PUBLIC_APP_URL:''},{DEV_MODE:'1'},{TELEGRAM_BOT_ID:'999'},{ROOM_JWT_SECRET:''},{PORT:'3000'},{PORT:'03001'},{PORT:'3067'}])assert.throws(()=>fullEnvironment({...env,...patch}),/DEPLOY_CONFIG_INVALID/);
 try{fullEnvironment({...env,BOT_TOKEN:'SECRET_INVALID_INPUT'});}catch(error){assert.ok(!(error as Error).message.includes('SECRET_INVALID_INPUT'));}
});
test('readiness requires both live HTTP services, not just a listening gateway',async()=>{
 let failed=false;
 const server=createServer((req,res)=>res.writeHead(failed&&req.url==='/bot'?503:200).end('test'));
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const address=server.address();assert.ok(address&&typeof address==='object');
 const base=`http://127.0.0.1:${address.port}`;
 const request=(url:string,options:any)=>fetch(base+(url.includes('3067')?'/bot':'/web'),options);
 try{assert.equal(await servicesReady(request),true);failed=true;assert.equal(await servicesReady(request),false);}
 finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
 assert.equal(await servicesReady(async()=>{throw new Error('network secret');}),false);
});
test('gateway splits HTTP page and WebSocket room while retaining media/range streaming routes',()=>{
 const nginx=readFileSync('deploy/render/full-nginx.conf','utf8');
 assert.ok(nginx.includes('map $http_upgrade $room_backend'));assert.ok(nginx.includes('~*websocket http://127.0.0.1:3067'));
 assert.ok(nginx.includes('location = /room { proxy_pass $room_backend; }'));
 assert.ok(nginx.includes('(preview|logo|video|media|avatar)'));assert.ok(nginx.includes('access_log off'));
 assert.ok(nginx.includes('listen __PORT__'));assert.ok(nginx.includes('proxy_http_version 1.1'));
});
test('full image includes both sources, browser build, gateway and supervised startup, with no secret build args',()=>{
 const docker=readFileSync('Dockerfile','utf8');
 for(const item of ['AS web-build','AS bot-build','/app/web','/app/bot','nginx','bootstrap-full.sh','MONGO_DB=playeon_test'])assert.ok(docker.includes(item),item);
 assert.doesNotMatch(docker,/ARG (BOT_TOKEN|API_HASH|ROOM_JWT_SECRET)/);
 const supervisor=readFileSync('deploy/render/start-full.mjs','utf8');
 assert.ok(supervisor.includes("process.once('SIGTERM'"));assert.ok(supervisor.includes("child.kill('SIGTERM')"));assert.ok(supervisor.includes("child.kill('SIGKILL')"));
 assert.ok(readFileSync('deploy/render/bootstrap-full.sh','utf8').includes('exec gosu node node'));
});
test('sole default Dockerfile starts full application and uses supplied Render origin',()=>{
 const docker=readFileSync('Dockerfile','utf8');
 assert.ok(docker.includes('AS web-build'));assert.ok(docker.includes('AS bot-build'));
 assert.ok(docker.includes('bootstrap-full.sh'));assert.ok(!docker.includes('dist/scripts/run-playback.js'));
 assert.ok(docker.includes('ARG PUBLIC_APP_URL=https://multi-musicbot.onrender.com'));
 const yaml=readFileSync('render.yaml','utf8');
 assert.match(yaml,/dockerfilePath: \.\/Dockerfile\n/);assert.ok(yaml.includes('value: https://multi-musicbot.onrender.com'));
});
