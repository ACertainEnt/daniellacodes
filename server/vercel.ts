/* Vercel Node function entry. This file is bundled by `npm run build:vercel`
   into a single self-contained api/index.js, because Vercel's TS function
   transpiler does not follow imports outside the api/ directory. */
import { createApp } from './app';

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
