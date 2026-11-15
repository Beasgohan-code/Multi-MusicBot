import {EMOJIS,type EmojiName} from './custom-emojis/catalog.js';
export {EMOJIS,type EmojiName} from './custom-emojis/catalog.js';
/** Enable only after verifying the sending bot's Telegram custom-emoji eligibility. */
export interface UiCapabilities {customEmoji?:boolean}
export const escapeHtml=(text:string):string=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function emoji(name:EmojiName,capabilities:UiCapabilities={},surface:'html'|'plain'='html'):string{
 const entry=EMOJIS[name];
 if(!entry)throw new Error('UI_EMOJI_UNKNOWN');
 const glyph=surface==='html'?escapeHtml(entry.fallback):entry.fallback;
 return surface==='html'&&capabilities.customEmoji===true?`<tg-emoji emoji-id="${entry.id}">${glyph}</tg-emoji>`:glyph;
}
/** Button labels and callback toasts cannot contain Telegram HTML. */
export function button(icon:EmojiName,label:string,data:string,capabilities:UiCapabilities={}){
 if(!data||Buffer.byteLength(data,'utf8')>64)throw new Error('UI_CALLBACK_INVALID');
 return {text:`${emoji(icon,capabilities,'plain')} ${label}`,callback_data:data};
}
const messages={
 welcome:{icon:'robot',title:'Welcome to MultiMusicBot'},
 clones:{icon:'ios_computer',title:'Your bot fleet'},
 settings:{icon:'target',title:'Bot settings'},
 playing:{icon:'music',title:'Now playing'},
 queue:{icon:'ios_archive',title:'Playback queue'},
 error:{icon:'warn',title:'Action needs attention'},
} as const satisfies Record<string,{icon:EmojiName;title:string}>;
/** Single policy for platform, clone-manager and playback message builders. */
export function uiMessage(kind:keyof typeof messages,body:string,capabilities:UiCapabilities={}){
 const template=messages[kind];
 return {text:`${emoji(template.icon,capabilities)} <b>${template.title}</b>\n\n${escapeHtml(body)}`,parse_mode:'HTML' as const};
}
