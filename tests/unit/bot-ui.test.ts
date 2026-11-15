import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emoji,button,escapeHtml,uiMessage} from '../../packages/bot-ui/index.js';
import {EMOJIS} from '../../packages/bot-ui/custom-emojis/catalog.js';
test('Videl0 catalogue retains aliases, string IDs and Unicode fallbacks',()=>{
 assert.equal(Object.keys(EMOJIS).length,664);
 assert.equal(new Set(Object.values(EMOJIS).map(e=>e.id)).size,611);
 assert.equal(EMOJIS.music.id,'5463107823946717464');
 for(const item of Object.values(EMOJIS)){assert.match(item.id,/^[1-9]\d{0,18}$/);assert.ok(BigInt(item.id)<=9223372036854775807n);assert.ok(item.fallback);}
});
test('surface-aware rendering never puts HTML in buttons/toasts',()=>{
 assert.equal(emoji('music',{customEmoji:true}),'<tg-emoji emoji-id="5463107823946717464">🎵</tg-emoji>');
 assert.equal(emoji('music'),'🎵');
 assert.equal(emoji('music',{customEmoji:true},'plain'),'🎵');
 assert.deepEqual(button('music','Play','play',{customEmoji:true}),{text:'🎵 Play',callback_data:'play'});
 assert.equal(escapeHtml('<b>&"'), '&lt;b&gt;&amp;&quot;');
});
test('all message templates escape tenant text and share emoji policy',()=>{
 for(const kind of ['welcome','clones','settings','playing','queue','error'] as const){
  const rich=uiMessage(kind,'<script>&',{customEmoji:true});assert.equal(rich.parse_mode,'HTML');
  assert.ok(rich.text.includes('<tg-emoji'));assert.ok(rich.text.includes('&lt;script&gt;&amp;'));
  assert.ok(!uiMessage(kind,'test').text.includes('<tg-emoji'));
 }
});

test('callback data respects Telegram UTF-8 byte limits',()=>{
 assert.throws(()=>button('music','Play','a'.repeat(65)),/UI_CALLBACK_INVALID/);
 assert.throws(()=>button('music','Play','🎵'.repeat(17)),/UI_CALLBACK_INVALID/);
 assert.throws(()=>button('music','Play',''),/UI_CALLBACK_INVALID/);
 assert.equal(button('music','Play','a'.repeat(64)).callback_data.length,64);
});
