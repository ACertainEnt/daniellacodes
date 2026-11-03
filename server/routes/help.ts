import { Router } from 'express';
import { requireUser, requireRole } from '../auth';
import type { AuthedRequest } from '../auth';
import { db } from '../db';
import { now, randomId } from '../env';
import { helpView, whatsappUrl } from '../services';

export const helpRouter = Router();
helpRouter.use(requireUser);

/** Validates, persists the question FIRST, then returns a real prefilled
 *  Click-to-Chat URL. The browser only opens WhatsApp after this succeeds. */
helpRouter.post('/', requireRole('student'), async (req, res) => {
  const user = (req as AuthedRequest).user;
  const raw = req.body?.question;
  const question = typeof raw === 'string' ? raw.trim() : '';
  if (question.length < 10) return res.status(400).json({ error: 'Please describe your question in at least 10 characters.' });
  if (question.length > 2000) return res.status(400).json({ error: 'Please keep your question under 2000 characters.' });
  const { sessionId = null, lessonId = null } = req.body || {};
  const session = sessionId ? await db.one('sessions', { id: sessionId }) : null;
  const lesson = lessonId ? await db.one('lessons', { id: lessonId }) : null;
  const id = randomId();
  const createdAt = now();
  await db.insert('help_requests', {
    id, profile_id: user.id, session_id: session?.id ?? null, lesson_id: lesson?.id ?? null,
    question, status: 'pending', created_at: createdAt,
    answered_at: null, answer: null, answered_by: null, answered_via: null,
  });
  res.json({
    ok: true, requestId: id, status: 'pending', createdAt,
    message: 'Your question has been sent to Ace. Status: Pending.',
    whatsappUrl: whatsappUrl({
      session: session?.title || 'Not specified',
      lesson: lesson?.title || 'Not specified',
      question, requestId: id,
    }),
  });
});

helpRouter.get('/mine', requireRole('student'), async (req, res) => {
  const user = (req as AuthedRequest).user;
  const rows = await db.all('help_requests', { where: { profile_id: user.id }, order: { column: 'created_at', dir: 'desc' } });
  res.json({ questions: await Promise.all(rows.map(helpView)) });
});
