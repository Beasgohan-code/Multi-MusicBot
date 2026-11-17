import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const read=(path:string)=>readFileSync(path,'utf8');
test('container builds both applications and includes media runtime with no secret build arguments',()=>{
 const docker=read('Dockerfile');
 for(const expected of ['node:22-bookworm-slim','AS web-build','AS bot-build','npm ci','npm run build','npm run typecheck','/app/bot','/app/web','ffmpeg','tini','nginx','bootstrap-full.sh'])assert.ok(docker.includes(expected),expected);
 assert.doesNotMatch(docker,/COPY\s+\.\s/i);
 assert.doesNotMatch(docker,/^\s*(?:ARG|ENV)\s+(?:ASSISTANT_SESSION|API_HASH|WORKER_GRANT|MONGODB_URI|BOT_TOKEN)\b/m);
});
test('container starts supervised stack under tini and drops privileges before application startup',()=>{
 const docker=read('Dockerfile');
 assert.match(docker,/ENTRYPOINT \["\/usr\/bin\/tini", "--", "\/bin\/sh", "\/opt\/deploy\/bootstrap-full.sh"\]/);
 assert.match(read('deploy/render/bootstrap-full.sh'),/exec gosu node node/);
 assert.match(read('deploy/render/start-full.mjs'),/process.once\('SIGTERM'/);
 assert.doesNotMatch(docker,/dist\/scripts\/run-playback.js/);
});
test('build context excludes credentials, sessions, media and local environments',()=>{
 const rules=read('.dockerignore').split(/\r?\n/);
 for(const pattern of ['.git','**/.env','**/.env.*','**/*.session','**/*.session-*','**/.venv*','node_modules','dist','media','**/__pycache__'])assert.ok(rules.includes(pattern),pattern);
 assert.ok(!rules.some(rule=>rule.startsWith('!')),'no secret-exclusion overrides');
});

test('session disk setup succeeds when absent or already present, without hiding file collisions',{skip:process.platform==='win32'},()=>{
 const command=read('deploy/render/bootstrap-full.sh').match(/^(mkdir[^\n]+)$/m);
 assert.ok(command,'expected standalone session mkdir bootstrap step');
 const root=mkdtempSync(join(tmpdir(),'voice-image-dir-'));
 const directory=join(root,'media'),sentinel=join(directory,'keep.txt'),collision=join(root,'file');
 const run=(target:string)=>spawnSync('sh',['-c',command[1]!.trim().replace('/var/data',JSON.stringify(target))],{encoding:'utf8'});
 try{
  assert.equal(run(directory).status,0,'first creation must succeed');
  writeFileSync(sentinel,'preserved');
  assert.equal(run(directory).status,0,'existing base-image directory must not fail the build');
  assert.equal(readFileSync(sentinel,'utf8'),'preserved');
  writeFileSync(collision,'not a directory');
  assert.notEqual(run(collision).status,0,'real filesystem errors must still fail closed');
 }finally{rmSync(root,{recursive:true,force:true});}
});
