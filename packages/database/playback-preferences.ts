import type {Collection} from 'mongodb';
export type PlaybackMode='vc'|'webapp';
export interface PlaybackPreference {mode:PlaybackMode;revision:number;status:'unapplied'}
const identity=(v:unknown):v is string=>typeof v==='string'&&/^[1-9]\d{0,19}$/.test(v);
const modeValid=(v:unknown):v is PlaybackMode=>v==='vc'||v==='webapp';
function validPreference(value:PlaybackPreference):void{
 if(!value||!modeValid(value.mode)||!Number.isSafeInteger(value.revision)||value.revision<0||value.status!=='unapplied')throw new Error('PLAYBACK_PREFERENCE_INVALID');
}
/** Startup admission only. Never interpret a desired preference as an applied acknowledgement.
 * There is no WebApp backend yet: its selection must not silently start a VC.
 */
export function requireVoiceMode(value:PlaybackPreference):void{
 validPreference(value);
 if(value.mode==='webapp')throw new Error('WEBAPP_PLAYBACK_NOT_AVAILABLE');
}
/** Internal repository, not an authentication endpoint. ownerId MUST come from
 * authenticated controller context (or a trusted DB operator), never request JSON.
 * Atomic owner/suspension/revision predicates share the existing bots document.
 * Selection affects a future startup snapshot, never an in-flight assistant lease.
 */
export class PlaybackPreferences {
 constructor(private readonly bots:Collection){}
 private scope(botId:string,ownerId:string){
  if(!identity(botId)||!identity(ownerId))throw new Error('PLAYBACK_PREFERENCE_INVALID');
  return {botId,ownerId,suspended:{$ne:true}};
 }
 async read(botId:string,ownerId:string):Promise<PlaybackPreference>{
  const bot=await this.bots.findOne(this.scope(botId,ownerId),{projection:{_id:0,playbackPreference:1,playbackPreferenceRevision:1}});
  if(!bot)throw new Error('PLAYBACK_PREFERENCE_UNAUTHORIZED');
  if(bot.playbackPreference===undefined&&bot.playbackPreferenceRevision===undefined)return {mode:'vc',revision:0,status:'unapplied'};
  const value:PlaybackPreference={mode:bot.playbackPreference?.mode,revision:bot.playbackPreferenceRevision,status:'unapplied'};
  validPreference(value);
  if(value.revision<1||!identity(bot.playbackPreference?.requestedBy))throw new Error('PLAYBACK_PREFERENCE_INVALID');
  return value;
 }
 async request(botId:string,ownerId:string,expectedRevision:number,mode:PlaybackMode):Promise<PlaybackPreference>{
  const scope=this.scope(botId,ownerId);
  if(!modeValid(mode)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER)throw new Error('PLAYBACK_PREFERENCE_INVALID');
  const previous=await this.read(botId,ownerId);
  if(previous.revision!==expectedRevision)throw new Error('PLAYBACK_PREFERENCE_CONFLICT');
  const revision=expectedRevision+1;
  // No upsert: this cannot create/attach a bot or change its owner.
  const result=await this.bots.updateOne({...scope,...(expectedRevision===0?{playbackPreferenceRevision:{$exists:false},playbackPreference:{$exists:false}}:{playbackPreferenceRevision:expectedRevision})},{$set:{playbackPreferenceRevision:revision,playbackPreference:{mode,requestedBy:ownerId,requestedAt:new Date()}}},{writeConcern:{w:'majority'}});
  if(!result.acknowledged)throw new Error('PLAYBACK_PREFERENCE_WRITE_UNCERTAIN');
  if(result.matchedCount!==1)throw new Error('PLAYBACK_PREFERENCE_CONFLICT');
  return {mode,revision,status:'unapplied'};
 }
}
