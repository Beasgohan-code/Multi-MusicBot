import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Deployment validation is pure and must run before importing upstream code.
// @ts-expect-error deployment JS deliberately has no generated declaration
import {validateDeployment} from '../../deploy/render/validate.mjs';
const env={BOT_USERNAME:'MyTestBot',NEXT_PUBLIC_BOT_USERNAME:'MyTestBot',NODE_ENV:'production',API_ID:'12345',API_HASH:'a'.repeat(32),BOT_TOKEN:'12345:'+ 'a'.repeat(35),ROOM_JWT_SECRET:'a'.repeat(64),MONGO_URI:'mongodb://db.example.test/music',MONGO_DB:'music',REDIS_URL:'rediss://cache.example.test:6379',ROOM_PUBLIC_URL:'https://my-bot.onrender.com',WEB_PUBLIC_URL:'https://my-web.onrender.com',NEXT_PUBLIC_ROOM_WS_URL:'https://my-bot.onrender.com',SESSION_NAME:'/var/data/playeon-session'};
test('Render configuration accepts explicit private-test bindings for both services',()=>{
 assert.deepEqual(validateDeployment('bot',env),[]);assert.deepEqual(validateDeployment('web',env),[]);
});
test('Render configuration denies auth bypass, mismatched bot identity and secret omissions',()=>{
 for(const patch of [{DEV_MODE:'1'},{NODE_ENV:'development'},{ROOM_JWT_SECRET:''},{BOT_TOKEN:''},{TELEGRAM_BOT_ID:'999'},{MONGO_URI:''}]){
  assert.ok(validateDeployment('web',{...env,...patch}).length>0);
 }
});
test('Render configuration rejects browser localhost, upstream defaults, URL secrets and paths',()=>{
 for(const value of ['http://localhost:3067','https://socket-playeon-bot.xysushi.in','https://u:p@my-bot.onrender.com','https://my-bot.onrender.com/ws','https://my-bot.onrender.com?token=secret'])assert.ok(validateDeployment('web',{...env,NEXT_PUBLIC_ROOM_WS_URL:value}).length>0,value);
});
test('Render bot requires cache and persistent session while web does not require assistant credentials',()=>{
 assert.ok(validateDeployment('bot',{...env,REDIS_URL:''}).includes('REDIS_URL'));
 assert.ok(validateDeployment('bot',{...env,SESSION_NAME:'./session'}).includes('SESSION_NAME'));
 assert.deepEqual(validateDeployment('web',env),[]);
});
test('Render blueprint points only to combined Docker service without operator replay arguments',()=>{
 const yaml=readFileSync('render.yaml','utf8');
 assert.ok(yaml.includes('dockerfilePath: ./Dockerfile\n'));assert.ok(!yaml.includes('fromService:'));
 assert.ok(yaml.includes('healthCheckPath: /health'));assert.ok(yaml.includes('mountPath: /var/data'));
 assert.ok(!yaml.includes('ASSISTANT_SESSION'));assert.ok(!yaml.includes('--enqueue'));
 assert.ok(!yaml.includes('Dockerfile.vc'));
});
test('Docker deployment retains signal forwarding, uses mounted-disk privilege drop and excludes build artifacts',()=>{
 const docker=readFileSync('Dockerfile','utf8');
 assert.ok(docker.includes('npm ci --include=dev'));assert.ok(docker.includes('npm run typecheck'));
 assert.ok(docker.includes('tini'));assert.ok(docker.includes('bootstrap-full.sh'));
 assert.match(readFileSync('deploy/render/bootstrap-full.sh','utf8'),/exec gosu node/);
 assert.match(readFileSync('deploy/render/start-full.mjs','utf8'),/launch\('bot','node',\['--import','tsx'/);
 assert.ok(docker.includes('--chown=node:node'));assert.ok(docker.includes('ARG PUBLIC_APP_URL='));
 assert.ok(!/ARG (BOT_TOKEN|API_HASH|ROOM_JWT_SECRET)/.test(docker));
 assert.ok(readFileSync('.dockerignore','utf8').includes('**/.next'));
});

test('invalid port and malformed administrator lists cannot bypass startup validation',()=>{
 for(const patch of [{PORT:'0'},{PORT:'65536'},{PORT:'10000x'},{DEV_IDS:'not-a-user'},{DEV_IDS:'123,$ne'}])assert.ok(validateDeployment('bot',{...env,...patch}).length>0);
 assert.deepEqual(validateDeployment('bot',{...env,PORT:'10000',DEV_IDS:'123,456'}),[]);
});
test('direct Render bot Dockerfile is at repo root and matches Blueprint with safe defaults',()=>{
 const docker=readFileSync('Dockerfile','utf8');
 const yaml=readFileSync('render.yaml','utf8');
 assert.ok(yaml.includes('dockerfilePath: ./Dockerfile\n'));
 assert.ok(docker.includes('SESSION_NAME=/var/data/playeon-session'));
 assert.ok(docker.includes('MONGO_DB=playeon_test'));
 assert.ok(docker.includes('bootstrap-full.sh'));
 const template=readFileSync('deploy/render/bot.env.example','utf8');
 for(const key of ['API_ID','API_HASH','BOT_TOKEN','BOT_USERNAME','ROOM_JWT_SECRET','MONGO_URI','REDIS_URL','PUBLIC_APP_URL'])assert.match(template,new RegExp('^'+key+'=','m'));
});
