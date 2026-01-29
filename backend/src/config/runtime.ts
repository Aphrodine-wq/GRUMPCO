export type ServerlessMode = 'vercel' | 'local';

export const isVercelRuntime = Boolean(process.env.VERCEL);
export const serverlessMode: ServerlessMode =
  process.env.SERVERLESS_MODE === 'vercel' || isVercelRuntime ? 'vercel' : 'local';

export const isServerlessRuntime = serverlessMode === 'vercel';

export const eventsMode = process.env.EVENTS_MODE ?? (isServerlessRuntime ? 'poll' : 'sse');
