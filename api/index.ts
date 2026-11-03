/* Vercel Node function: the whole Express API behind a single handler.
   Static files come from the Vite build (dist/) and are served by Vercel's
   CDN; vercel.json rewrites /api/* and /files/* to this function. */
import { createApp } from '../server/app';

type Handler = (req: any, res: any) => void;
let ready: Promise<Handler> | undefined;

export default async function handler(req: any, res: any) {
  try {
    // One initialisation per warm instance. seedDatabase() is idempotent and
    // short-circuits on the settings.seed_complete marker after the first run.
    ready ??= createApp() as unknown as Promise<Handler>;
    const app = await ready;
    return app(req, res);
  } catch (err: any) {
    console.error('[boot]', err?.stack || err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    // Detailed boot errors are enabled only by an explicitly-set server-side
    // flag used during deployment verification; never exposed by default.
    res.end(JSON.stringify(process.env.DEBUG_BOOT === '1'
      ? { error: 'boot_failed', detail: String(err?.message || err), stack: String(err?.stack || '').slice(0, 2000) }
      : { error: 'Something went wrong on the server. No internal details are exposed.' }));
  }
}

export const config = { maxDuration: 300 };
