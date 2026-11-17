import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const read=(path:string)=>readFileSync(path,'utf8');
test('container builds compiled Node runtime and selected isolated native voice baseline',()=>{
 const docker=read('Dockerfile.vc');
 for(const expected of ['node:22-bookworm-slim','python:3.11-slim-bookworm','npm ci','npm run build','npm prune --omit=dev','requirements-kurigram.lock.txt','python -m venv /opt/voice','ffmpeg','tini','USER app','dist/scripts/run-playback.js'])assert.ok(docker.includes(expected),expected);
 assert.doesNotMatch(docker,/COPY\s+\.\s/i);
 assert.doesNotMatch(docker,/^\s*(?:ARG|ENV)\s+(?:ASSISTANT_SESSION|API_HASH|WORKER_GRANT|MONGODB_URI|BOT_TOKEN)\b/m);
});
test('container default command uses direct Node and init forwards signals to the runner',()=>{
 const docker=read('Dockerfile.vc');
 assert.match(docker,/ENTRYPOINT \["\/usr\/bin\/tini", "--"\]/);
 assert.match(docker,/CMD \["node", "dist\/scripts\/run-playback.js"\]/);
 assert.match(docker,/VOICE_PYTHON=\/opt\/voice\/bin\/python/);
 assert.doesNotMatch(docker,/^EXPOSE\b/m);
});
test('build context excludes credentials, sessions, media and local environments',()=>{
 const rules=read('.dockerignore').split(/\r?\n/);
 for(const pattern of ['.git','**/.env','**/.env.*','**/*.session','**/*.session-*','**/.venv*','node_modules','dist','media','**/__pycache__'])assert.ok(rules.includes(pattern),pattern);
 assert.ok(!rules.some(rule=>rule.startsWith('!')),'no secret-exclusion overrides');
});

test('VC image media directory setup succeeds when absent or already present, without hiding file collisions',{skip:process.platform==='win32'},()=>{
 const command=read('Dockerfile.vc').match(/&& (mkdir[^\\\n]+)\\/);
 assert.ok(command,'expected standalone media mkdir build step');
 const root=mkdtempSync(join(tmpdir(),'voice-image-dir-'));
 const directory=join(root,'media'),sentinel=join(directory,'keep.txt'),collision=join(root,'file');
 const run=(target:string)=>spawnSync('sh',['-c',command[1]!.trim().replace('/media',JSON.stringify(target))],{encoding:'utf8'});
 try{
  assert.equal(run(directory).status,0,'first creation must succeed');
  writeFileSync(sentinel,'preserved');
  assert.equal(run(directory).status,0,'existing base-image directory must not fail the build');
  assert.equal(readFileSync(sentinel,'utf8'),'preserved');
  writeFileSync(collision,'not a directory');
  assert.notEqual(run(collision).status,0,'real filesystem errors must still fail closed');
 }finally{rmSync(root,{recursive:true,force:true});}
});
