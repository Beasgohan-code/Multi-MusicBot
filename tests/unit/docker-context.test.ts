import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import type {Ignore} from '@balena/dockerignore';
const dockerignore=createRequire(import.meta.url)('@balena/dockerignore') as ()=>Ignore;
const context=()=>dockerignore().add(readFileSync('.dockerignore','utf8'));
test('Docker build context preserves every pinned bot and web source module, including logging code',()=>{
 const manifest=JSON.parse(readFileSync('vendor/playeon/UPSTREAM.json','utf8'));
 const matcher=context();let checked=0;
 for(const path of Object.keys(manifest.sha256)){
  if(!/^playeon-(bot|web)\/src\//.test(path))continue;
  const full='vendor/playeon/'+path;assert.ok(existsSync(full),full);
  assert.equal(matcher.ignores(full),false,`source excluded from Docker context: ${full}`);checked++;
 }
 assert.ok(checked>200);
});
test('Docker build context still excludes secrets and runtime logs without excluding source directories',()=>{
 const matcher=context();
 for(const path of ['.env','vendor/playeon/playeon-bot/.env','vendor/playeon/playeon-web/.env.local','vendor/playeon/playeon-bot/test.session','logs/output.log','vendor/playeon/playeon-bot/logs/output.txt','vendor/playeon/playeon-bot/node_modules/module/index.js','vendor/playeon/playeon-web/.next/server/app.js'])assert.ok(matcher.ignores(path),path);
 assert.equal(matcher.ignores('vendor/playeon/playeon-bot/src/services/logs/commandError.ts'),false);
});
test('only root Dockerfile remains in root and deployment directories',()=>{
 const files=[...readdirSync('.').filter(f=>/dockerfile/i.test(f)),...readdirSync('deploy/render').filter(f=>/dockerfile/i.test(f)).map(f=>'deploy/render/'+f)];
 assert.deepEqual(files.sort(),['Dockerfile']);
 for(const path of ['deploy/render/split-services.yaml','deploy/render/bootstrap-bot.sh','deploy/render/start.sh'])assert.equal(existsSync(path),false,path);
});
