import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executionConfig} from '../../apps/bot-runtime/execution-config.js';
test('operator runner validates fixed binding and rejects unknown media handle mappings',()=>{
 const env={WORKER_GRANT:'x'.repeat(43),MONGODB_URI:'mongodb://localhost:27017',MONGODB_DB:'music',VOICE_BOT_ID:'123',VOICE_CHAT_ID:'-1001',VOICE_ASSISTANT_ID:'assistant1',VOICE_MEDIA_ROOT:'/tmp/fixtures',VOICE_MEDIA_HANDLES:'{"a":"a.wav"}',API_ID:'123',API_HASH:'0'.repeat(32),ASSISTANT_SESSION:'local-session'};
 assert.equal(executionConfig(env).botId,'123');
 for(const patch of [{VOICE_BOT_ID:'other'},{VOICE_MEDIA_HANDLES:'{"../a":"file"}'},{MONGODB_DB:'../escape'},{MONGODB_URI:'https://secret-value'}]){
 assert.throws(()=>executionConfig({...env,...patch}),e=>e instanceof Error&&e.message==='EXECUTION_CONFIG_INVALID');
 }
});
test('operator playback cannot run without a well-formed worker grant',()=>{
 const env={MONGODB_URI:'mongodb://localhost:27017',MONGODB_DB:'music',VOICE_BOT_ID:'123',VOICE_CHAT_ID:'-1001',VOICE_ASSISTANT_ID:'assistant1',VOICE_MEDIA_ROOT:'/tmp/fixtures',VOICE_MEDIA_HANDLES:'{"a":"a.wav"}',API_ID:'123',API_HASH:'0'.repeat(32),ASSISTANT_SESSION:'local-session'};
 assert.throws(()=>executionConfig(env),/EXECUTION_CONFIG_INVALID/);
 assert.throws(()=>executionConfig({...env,WORKER_GRANT:'bad'}),/EXECUTION_CONFIG_INVALID/);
 assert.equal(executionConfig({...env,WORKER_GRANT:'x'.repeat(43)}).workerGrant,'x'.repeat(43));
});
