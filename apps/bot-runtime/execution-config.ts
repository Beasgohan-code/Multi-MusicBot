export function executionConfig(env:NodeJS.ProcessEnv){
 try{
  const required=(key:string,pattern:RegExp)=>{const v=env[key];if(!v||!pattern.test(v))throw new Error();return v;};
  const handles:unknown=JSON.parse(required('VOICE_MEDIA_HANDLES',/^.{1,8192}$/));
  if(!handles||typeof handles!=='object'||Array.isArray(handles)||Object.keys(handles).length>20||Object.entries(handles).some(([k,v])=>!/^[A-Za-z0-9_-]{1,128}$/.test(k)||typeof v!=='string'||!v||v.length>1024))throw new Error();
  return {
   workerGrant:required('WORKER_GRANT',/^[A-Za-z0-9_-]{43,128}$/),
   mongodbUri:required('MONGODB_URI',/^mongodb(?:\+srv)?:\/\/[^\s]+$/),mongodbDb:required('MONGODB_DB',/^[A-Za-z0-9_-]{1,63}$/),
   botId:required('VOICE_BOT_ID',/^[1-9]\d{0,19}$/),chatId:required('VOICE_CHAT_ID',/^-[1-9]\d{0,19}$/),
   assistantId:required('VOICE_ASSISTANT_ID',/^[A-Za-z0-9_-]{1,128}$/),
   apiId:required('API_ID',/^[1-9]\d{0,9}$/),apiHash:required('API_HASH',/^[a-fA-F0-9]{32}$/),session:required('ASSISTANT_SESSION',/^[A-Za-z0-9_=-]{1,8192}$/),
   mediaRoot:required('VOICE_MEDIA_ROOT',/^.{1,1024}$/),mediaHandles:handles as Record<string,string>,
   python:env.VOICE_PYTHON??'.venv-kurigram/bin/python',
  };
 }catch{throw new Error('EXECUTION_CONFIG_INVALID');}
}
