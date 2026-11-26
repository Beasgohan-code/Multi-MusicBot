import {validateDeployment} from './validate.mjs';
/** Only PUBLIC_APP_URL and BOT_USERNAME are baked into browser assets. */
export function fullEnvironment(input){
 const env={...input,ROOM_PUBLIC_URL:input.PUBLIC_APP_URL,WEB_PUBLIC_URL:input.PUBLIC_APP_URL,
  NEXT_PUBLIC_ROOM_WS_URL:input.PUBLIC_APP_URL,NEXT_PUBLIC_BOT_USERNAME:input.BOT_USERNAME,
  TELEGRAM_BOT_ID:input.BOT_TOKEN?.split(':')[0],ROOM_WS_PORT:'3067'};
 const invalid=[...new Set([...validateDeployment('bot',env),...validateDeployment('web',env)])];
 if([3000,3001,3067].includes(Number(env.PORT||10000)))invalid.push('PORT');
 // Do not silently accept an independently supplied mismatched identity.
 if(input.TELEGRAM_BOT_ID&&input.TELEGRAM_BOT_ID!==env.TELEGRAM_BOT_ID)invalid.push('TELEGRAM_BOT_ID');
 if(invalid.length)throw new Error(`DEPLOY_CONFIG_INVALID: ${[...new Set(invalid)].sort().join(', ')}`);
 return env;
}
export async function servicesReady(fetcher=fetch){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),2000);
 try{
  const results=await Promise.all(['http://127.0.0.1:3000/','http://127.0.0.1:3067/health'].map(url=>fetcher(url,{signal:controller.signal})));
  const ready=results.every(response=>response.ok);
  await Promise.all(results.map(response=>response.body?.cancel()));
  return ready;
 }catch{return false;}
 finally{clearTimeout(timer);controller.abort();}
}

/** Shared deployment health handler; probes are injected only by offline tests. */
export function createHealthHandler(isStopping, check=servicesReady){
 return async(req,res)=>{
  if(req.url!=='/health'){res.writeHead(404).end();return;}
  let ready=false;
  try{
   // A completed probe is not current admission evidence if shutdown began
   // while its HTTP requests were outstanding. Never cache/restore readiness.
   if(!isStopping())ready=(await check())===true&&!isStopping();
  }catch{ /* Health failures are unready, never raw error responses. */ }
  res.writeHead(ready?200:503,{'Content-Type':'text/plain','Cache-Control':'no-store'}).end(ready?'ok':'not ready');
 };
}
