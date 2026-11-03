/* Vercel Node function: the whole Express API behind a single handler.
   Static files come from the Vite build (dist/) and are served by Vercel's
   CDN; vercel.json rewrites /api/* and /files/* to this function. */
import { createApp } from '../server/app';

type Handler = (req: any, res: any) => void;
let ready: Promise<Handler> | undefined;

export default async function handler(req: any, res: any) {
  // One initialisation per warm instance. seedDatabase() is idempotent and
  // short-circuits on the settings.seed_complete marker after the first run.
  ready ??= createApp() as unknown as Promise<Handler>;
  const app = await ready;
  return app(req, res);
}

export const config = { maxDuration: 300 };
