import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { env, randomId, now } from './env';
import { db } from './db';
import { login } from './auth';
import { putFile } from './storage';
import { createClient } from '@supabase/supabase-js';
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

  // TEMPORARY deployment-verification probe. Removed after verification.
  if (process.env.DEBUG_BOOT === '1') {
    app.get('/api/_verify', async (req, res) => {
      const expected = process.env.VERIFY_TOKEN || '';
      if (!expected || req.query.t !== expected) return res.status(404).json({ error: 'Not found.' });
      const out: Record<string, any> = { driver: env.driver, authMode: env.authMode };
      try {
        const student = await login(env.studentAccount, env.studentPassword);
        const instructor = await login(env.instructorAccount, env.instructorPassword);
        const bad = await login(env.studentAccount, 'definitely-not-the-password');
        out.student = student ? { role: (student.profile as any).role, account: (student.profile as any).accountId, jwt: !!student.token } : null;
        out.instructor = instructor ? { role: (instructor.profile as any).role, account: (instructor.profile as any).accountId, jwt: !!instructor.token } : null;
        out.wrongPasswordRejected = bad === null;
        out.rolesSeparate = out.student?.role === 'student' && out.instructor?.role === 'instructor';
        out.counts = {
          sessions: (await db.all('sessions')).length,
          lessons: (await db.all('lessons')).length,
          exams: (await db.all('exams')).length,
          questions: (await db.all('question_bank')).length,
          variants: (await db.all('exam_variants')).length,
          videos: (await db.all('video_resources')).length,
          seedComplete: !!(await db.one('settings', { key: 'seed_complete' })),
        };
        const profile = await db.one('profiles', { account_id: env.studentAccount });
        const lesson = (await db.all('lessons', { limit: 1 }))[0];
        const testId = randomId();
        await db.insert('lesson_progress', { id: testId, profile_id: profile!.id, lesson_id: lesson.id, completed_at: now() });
        const written = await db.one('lesson_progress', { id: testId });
        await db.remove('lesson_progress', { id: testId });
        const removed = await db.one('lesson_progress', { id: testId });
        out.dbWriteReadDelete = !!written && removed === null;
        const storageName = '__verify.txt';
        const storageUrl = await putFile('subtitles', storageName, 'DANIELLACODES production storage probe', 'text/plain');
        const client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, { auth: { persistSession: false } });
        const { data: buckets } = await client.storage.listBuckets();
        out.storage = { upload: !!storageUrl, buckets: (buckets || []).map(b => b.name) };
        await client.storage.from('subtitles').remove([storageName]);
      } catch (e: any) {
        out.error = String(e?.message || e);
      }
      return res.json(out);
    });
  }
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
