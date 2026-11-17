import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('personal-test Playeon snapshot tracks pinned upstream source, explicit local patches and original attribution',()=>{
 const root='vendor/playeon/';
 const provenance=JSON.parse(readFileSync(root+'UPSTREAM.json','utf8'));
 assert.equal(provenance.repository,'https://github.com/playeon/playeon');
 assert.equal(provenance.commit,'6ec6097bc7f5db19583618c226a5e4c410b90cee');
 assert.equal(provenance.purpose,'personal-noncommercial-evaluation');
 assert.ok(Object.keys(provenance.sha256).length>=280);
 for(const [path,hash] of Object.entries(provenance.sha256)){
  assert.ok(!path.startsWith('/')&&!path.split('/').includes('..'));
  const change=provenance.localChanges?.[path];
  if(change)assert.ok(typeof change.reason==='string'&&change.reason.length>0);
  assert.equal(createHash('sha256').update(readFileSync(root+path)).digest('hex'),change?.sha256??hash,path);
 }
 const license=readFileSync(root+'LICENSE','utf8');
 assert.match(license,/Sushi <contact@xysushi.in>/);assert.match(license,/NON-COMMERCIAL RESTRICTION/);
});
test('Playeon privacy command parses and WebApp layout does not fetch build-time Google fonts',async()=>{
 const ts=await import('typescript');
 const source=readFileSync('vendor/playeon/playeon-bot/src/commands/general/privacy.ts','utf8');
 const result=ts.transpileModule(source,{reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 assert.deepEqual(result.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>d.code),[]);
 assert.doesNotMatch(readFileSync('vendor/playeon/playeon-web/src/app/layout.tsx','utf8'),/next\/font\/google/);
});
