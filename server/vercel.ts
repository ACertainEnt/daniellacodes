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
    // Never expose internal details (connection strings, stack traces) to the
    // browser. Diagnostics go to the server log only.
    console.error('[boot]', err?.stack || err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Something went wrong on the server. No internal details are exposed.' }));
  }
}

export const config = { maxDuration: 300 };
