import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Collection} from 'mongodb';
import {MongoAudit} from '../../packages/observability/audit.js';
test('audit accepts only structured safe event fields, never arbitrary credentials',async()=>{
 const saved:unknown[]=[];
 const sink=new MongoAudit({insertOne:async(d:unknown)=>{saved.push(d);}} as unknown as Collection);
 await sink.append({type:'playback_started',botId:'123',chatId:'-1001',sessionId:'s1',generation:1});
 assert.equal(saved.length,1);
 await assert.rejects(sink.append({type:'playback_started',botId:'123',chatId:'-1001',sessionId:'s1',generation:1,token:'secret'} as never),/AUDIT_INVALID/);
 await assert.rejects(sink.append({type:'secret-session-string',botId:'123',chatId:'-1001',sessionId:'s1',generation:1}),/AUDIT_INVALID/);
 assert.ok(!JSON.stringify(saved).includes('secret'));
});
