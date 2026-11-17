import {fileURLToPath} from 'node:url';
/** No networking, secret output or upstream imports. Deny unsafe deployment defaults. */
export function validateDeployment(role, env) {
 const invalid=new Set();
 const requirePattern=(key,pattern)=>{if(typeof env[key]!=='string'||!pattern.test(env[key]))invalid.add(key);};
 const origin=key=>{
  try{
   const u=new URL(env[key]);
   const host=u.hostname.toLowerCase();
   if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||
    host==='localhost'||host==='127.0.0.1'||host==='[::1]'||host.endsWith('.local')||host==='xysushi.in'||host.endsWith('.xysushi.in'))throw new Error();
  }catch{invalid.add(key);}
 };
 if(role!=='bot'&&role!=='web')invalid.add('ROLE');
 if(env.NODE_ENV!=='production')invalid.add('NODE_ENV');
 if(env.PORT&&(!/^\d+$/.test(env.PORT)||Number(env.PORT)<1024||Number(env.PORT)>65535))invalid.add('PORT');
 if(env.DEV_IDS&&!/^[1-9]\d*(?:[ ,]+[1-9]\d*)*$/.test(env.DEV_IDS))invalid.add('DEV_IDS');
 if(env.DEV_MODE==='1')invalid.add('DEV_MODE');
 requirePattern('BOT_TOKEN',/^[1-9]\d{0,19}:[A-Za-z0-9_-]{30,}$/);
 requirePattern('ROOM_JWT_SECRET',/^[A-Za-z0-9_-]{43,128}$/);
 requirePattern('MONGO_URI',/^mongodb(?:\+srv)?:\/\/[^\s]+$/);
 requirePattern('MONGO_DB',/^[A-Za-z0-9_-]{1,63}$/);
 if(env.TELEGRAM_BOT_ID&&env.TELEGRAM_BOT_ID!==env.BOT_TOKEN?.split(':')[0])invalid.add('TELEGRAM_BOT_ID');
 if(env.TELEGRAM_BOT_TOKEN&&env.TELEGRAM_BOT_TOKEN!==env.BOT_TOKEN)invalid.add('TELEGRAM_BOT_TOKEN');
 if(role==='bot'){
  requirePattern('API_ID',/^[1-9]\d{0,9}$/);requirePattern('API_HASH',/^[a-fA-F0-9]{32}$/);
  requirePattern('REDIS_URL',/^rediss?:\/\/[^\s]+$/);
  requirePattern('SESSION_NAME',/^\/var\/data\/[A-Za-z0-9_-]{1,80}$/);
  requirePattern('BOT_USERNAME',/^[A-Za-z][A-Za-z0-9_]{4,31}$/);
  origin('ROOM_PUBLIC_URL');origin('WEB_PUBLIC_URL');
 }else if(role==='web'){origin('NEXT_PUBLIC_ROOM_WS_URL');requirePattern('NEXT_PUBLIC_BOT_USERNAME',/^[A-Za-z][A-Za-z0-9_]{4,31}$/);}
 return [...invalid].sort();
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const invalid=validateDeployment(process.argv[2],process.env);
 if(invalid.length){console.error(`DEPLOY_CONFIG_INVALID: ${invalid.join(', ')}. Fix service settings; values were not logged.`);process.exitCode=1;}
}
