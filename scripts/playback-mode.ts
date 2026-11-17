import {MongoClient} from 'mongodb';
import {PlaybackPreferences,type PlaybackMode} from '../packages/database/playback-preferences.js';
/** Trusted DB operator tool, NOT an owner authentication mechanism or public API.
 * OWNER_ID must be independently verified; DB credentials authorize the operator.
 * Secrets stay in environment; stdout contains only the desired preference.
 */
async function main(){
 const uri=process.env.MONGODB_URI??'',dbName=process.env.MONGODB_DB??'';
 const botId=process.env.VOICE_BOT_ID??'',ownerId=process.env.OWNER_ID??'';
 const [mode,revision,...extra]=process.argv.slice(2);
 if(!/^mongodb(?:\+srv)?:\/\/[^\s]+$/.test(uri)||!/^[A-Za-z0-9_-]{1,63}$/.test(dbName)||extra.length||
  (mode!==undefined&&mode!=='vc'&&mode!=='webapp')||
  (mode!==undefined&&(revision===undefined||!/^(0|[1-9]\d{0,15})$/.test(revision)))||
  (mode===undefined&&revision!==undefined))throw new Error('PLAYBACK_MODE_CONFIG_INVALID');
 const client=new MongoClient(uri,{serverSelectionTimeoutMS:3000,socketTimeoutMS:5000,maxPoolSize:3});
 try{
  await client.connect();
  const repo=new PlaybackPreferences(client.db(dbName).collection('bots'));
  const result=mode===undefined?await repo.read(botId,ownerId):await repo.request(botId,ownerId,Number(revision),mode as PlaybackMode);
  console.log(JSON.stringify(result));
 }finally{await client.close();}
}
main().catch(()=>{console.error('PLAYBACK_MODE_FAILED: verify current owner, bot availability and revision; inspect stored desired state before retrying. No playback application was confirmed.');process.exitCode=1;});
