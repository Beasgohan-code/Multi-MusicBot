export function loadConfig(env: NodeJS.ProcessEnv) {
  function required(name: string, pattern: RegExp): string {
    const value = env[name];
    if (!value || !pattern.test(value)) throw new Error(`CONFIG_INVALID:${name}`);
    return value;
  }
  function integer(name: string, fallback: number, max: number): number {
    const value = env[name] ?? String(fallback);
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) throw new Error(`CONFIG_INVALID:${name}`);
    return Number(value);
  }
  const encryptionKey = required('ENCRYPTION_KEY', /^[A-Za-z0-9+/]{43}=$/);
  if (Buffer.from(encryptionKey, 'base64').length !== 32 || Buffer.from(encryptionKey, 'base64').toString('base64') !== encryptionKey) throw new Error('CONFIG_INVALID:ENCRYPTION_KEY');
  return {
    botToken: required('BOT_TOKEN', /^\d+:[A-Za-z0-9_-]{30,}$/),
    ownerId: required('OWNER_ID', /^[1-9]\d*$/),
    mongodbUri: required('MONGODB_URI', /^mongodb(?:\+srv)?:\/\/[^\s]+$/),
    mongodbDb: required('MONGODB_DB', /^[A-Za-z0-9_-]{1,63}$/),
    encryptionKey: Buffer.from(encryptionKey, 'base64'),
    maxActiveCalls: integer('MAX_ACTIVE_CALLS', 1, 1),
    maxQueue: integer('MAX_QUEUE', 20, 100),
  };
}
