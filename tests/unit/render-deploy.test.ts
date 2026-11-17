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
test('Render blueprint points to separate Docker services and does not replace existing VC image',()=>{
 const yaml=readFileSync('render.yaml','utf8');
 assert.ok(yaml.includes('deploy/render/bot.Dockerfile'));assert.ok(yaml.includes('deploy/render/web.Dockerfile'));
 assert.ok(yaml.includes('healthCheckPath: /health'));assert.ok(yaml.includes('mountPath: /var/data'));
 assert.ok(!yaml.includes('ASSISTANT_SESSION'));assert.ok(!yaml.includes('--enqueue'));
 assert.match(readFileSync('Dockerfile','utf8'),/dist\/scripts\/run-playback.js/);
});
test('Docker deployment retains signal forwarding, uses mounted-disk privilege drop and excludes build artifacts',()=>{
 const bot=readFileSync('deploy/render/bot.Dockerfile','utf8');
 const web=readFileSync('deploy/render/web.Dockerfile','utf8');
 assert.ok(bot.includes('npm ci --include=dev'));assert.ok(bot.includes('npm run typecheck'));
 assert.ok(bot.includes('tini'));assert.ok(bot.includes('bootstrap-bot.sh'));
 assert.match(readFileSync('deploy/render/bootstrap-bot.sh','utf8'),/exec gosu node/);
 assert.match(readFileSync('deploy/render/start.sh','utf8'),/exec node --import tsx src\/index.ts/);
 assert.ok(web.includes('USER node'));assert.ok(web.includes('ARG NEXT_PUBLIC_ROOM_WS_URL'));
 assert.ok(!/ARG (BOT_TOKEN|API_HASH|ROOM_JWT_SECRET)/.test(web));
 assert.ok(readFileSync('.dockerignore','utf8').includes('**/.next'));
});

test('invalid port and malformed administrator lists cannot bypass startup validation',()=>{
 for(const patch of [{PORT:'0'},{PORT:'65536'},{PORT:'10000x'},{DEV_IDS:'not-a-user'},{DEV_IDS:'123,$ne'}])assert.ok(validateDeployment('bot',{...env,...patch}).length>0);
 assert.deepEqual(validateDeployment('bot',{...env,PORT:'10000',DEV_IDS:'123,456'}),[]);
});
