import {resolve} from 'node:path';
import {VoiceProcess} from './voice-process.js';
import type {ChildBinding} from './playback-runner.js';
interface Options {python:string;script:string;apiId:string;apiHash:string;session:string;mediaRoot:string;mediaHandles:Record<string,string>}
/** Only operator-provisioned secrets enter this factory. Never pass a tenant request body here. */
export function pythonChildFactory(options:Options):(binding:ChildBinding)=>VoiceProcess {
 if(!/^[1-9]\d*$/.test(options.apiId)||!/^[a-fA-F0-9]{32}$/.test(options.apiHash)||!/^[A-Za-z0-9_=-]{1,8192}$/.test(options.session))throw new Error('VOICE_CONFIG_INVALID');
 const root=resolve(options.mediaRoot),script=resolve(options.script);
 return b=>new VoiceProcess(options.python,[script],{
  API_ID:options.apiId,API_HASH:options.apiHash,ASSISTANT_SESSION:options.session,
  VOICE_BOT_ID:b.botId,VOICE_CHAT_ID:b.chatId,VOICE_SESSION_ID:b.source.sessionId,
  VOICE_GENERATION:String(b.source.generation),VOICE_MEDIA_ROOT:root,VOICE_MEDIA_HANDLES:JSON.stringify(options.mediaHandles),
  VOICE_LEASE_MS:String(b.validForMs),VOICE_MAX_SECONDS:'3600',
 });
}
