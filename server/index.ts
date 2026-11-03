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

async function main() {
  await seedDatabase();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '3mb' }));
  app.use(cookieParser());

  // Minimal security headers. CSP allows the privacy-enhanced YouTube embed,
  // its script, Google Fonts and thumbnails — nothing else is needed.
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if (env.isProd) {
      res.setHeader('Content-Security-Policy',
        "default-src 'self'; script-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; " +
        "frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https://i.ytimg.com https://*.googleusercontent.com; " +
        "connect-src 'self' https://www.youtube-nocookie.com https://www.youtube.com; " +
        "worker-src 'self' blob:;");
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

  if (env.isProd) {
    const dist = path.resolve(root, 'dist');
    app.use(express.static(dist, { maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      configFile: path.resolve(root, 'vite.config.ts'),
      root,
      appType: 'custom',
      server: { middlewareMode: true, hmr: { clientPort: 443 } },
    });
    app.use(vite.middlewares);
    app.use('*', async (req: Request, res: Response, next: NextFunction) => {
      try {
        const file = path.resolve(root, 'index.html');
        let html = fs.readFileSync(file, 'utf8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (err) { vite.ssrFixStacktrace(err as Error); next(err); }
    });
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err?.stack || err);
    res.status(500).json({ error: 'Something went wrong on the server. No internal details are exposed.' });
  });

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`\n  DANIELLACODES ready → http://0.0.0.0:${env.port}`);
    console.log(`  data driver: ${env.driver}   auth: ${env.authMode}   mode: ${env.isProd ? 'production' : 'development'}`);
    if (env.devFallbackSecret && !env.isProd) console.log('  ⚠  Set AUTH_SECRET in .env before deploying.\n');
  });
}

main().catch(err => { console.error('[fatal]', err); process.exit(1); });
