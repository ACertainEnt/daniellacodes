import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env';
import { seedDatabase } from './seed';
import { authRouter } from './routes/auth';
import { studentRouter } from './routes/student';
import { examRouter } from './routes/exams';
import { helpRouter } from './routes/help';
import { mediaRouter } from './routes/media';
import { instructorRouter } from './routes/instructor';

const root = process.cwd();

/**
 * Production / serverless Express application.
 *
 * This is deliberately a SEPARATE entry from `server/index.ts`: it contains no
 * `import('vite')` and never calls `listen()`, so it can be bundled into a
 * Vercel Node function without dragging the dev toolchain into the bundle.
 * Keep the route wiring here in sync with `server/index.ts`.
 */
export async function createApp() {
  await seedDatabase();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '3mb' }));
  app.use(cookieParser());

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Arena previews and Vercel preview URLs embed the app in an iframe from a
    // different origin, so CSP frame-ancestors is used instead of
    // X-Frame-Options: SAMEORIGIN. Clickjacking protection is retained.
    const frameAncestors = "frame-ancestors 'self' https://*.e2b.app https://*.vercel.app;";
    if (env.isProd) {
      res.setHeader('Content-Security-Policy',
        "default-src 'self'; script-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; " +
        "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https://i.ytimg.com https://*.googleusercontent.com; " +
        "connect-src 'self' https://www.youtube-nocookie.com https://www.youtube.com wss://*.e2b.app; " +
        "worker-src 'self' blob:; " + frameAncestors);
    } else {
      res.setHeader('Content-Security-Policy', frameAncestors);
    }
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, driver: env.driver, auth: env.authMode, time: new Date().toISOString() }));
  app.use('/api/auth', authRouter);
  app.use('/api/student', studentRouter);
  app.use('/api/exams', examRouter);
  app.use('/api/help', helpRouter);
  app.use('/api/media', mediaRouter);
  app.use('/api/instructor', instructorRouter);
  app.use('/files', express.static(env.storageDir, { fallthrough: true, maxAge: '1d' }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));

  // Static output is served by Vercel's CDN; this fallback only covers a
  // request that reaches the function directly (e.g. a hard refresh on /app).
  const dist = path.resolve(root, 'dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist, { maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err?.stack || err);
    res.status(500).json({ error: 'Something went wrong on the server. No internal details are exposed.' });
  });

  return app;
}
