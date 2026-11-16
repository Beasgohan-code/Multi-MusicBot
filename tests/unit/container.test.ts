import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path:string)=>readFileSync(path,'utf8');
test('container builds compiled Node runtime and selected isolated native voice baseline',()=>{
 const docker=read('Dockerfile');
 for(const expected of ['node:22-bookworm-slim','python:3.11-slim-bookworm','npm ci','npm run build','npm prune --omit=dev','requirements-kurigram.lock.txt','python -m venv /opt/voice','ffmpeg','tini','USER app','dist/scripts/run-playback.js'])assert.ok(docker.includes(expected),expected);
 assert.doesNotMatch(docker,/COPY\s+\.\s/i);
 assert.doesNotMatch(docker,/^\s*(?:ARG|ENV)\s+(?:ASSISTANT_SESSION|API_HASH|WORKER_GRANT|MONGODB_URI|BOT_TOKEN)\b/m);
});
test('container default command uses direct Node and init forwards signals to the runner',()=>{
 const docker=read('Dockerfile');
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
