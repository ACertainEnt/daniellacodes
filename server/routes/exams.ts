import { Router } from 'express';
import { requireUser, requireRole } from '../auth';
import type { AuthedRequest } from '../auth';
import { db } from '../db';
import { now, randomId } from '../env';
import { canStartExam, syncAchievements, attemptView } from '../services';
import { renderQuestion, publicQuestion, gradeAttempt, type Snapshot } from '../grading';
import { runJavaScript } from '../sandbox';
import type { ExamSheet, ExamResult } from '../../shared/types';

export const examRouter = Router();
examRouter.use(requireUser, requireRole('student'));

const ownedAttempt = async (req: AuthedRequest, res: any) => {
  const attempt = await db.one('exam_attempts', { id: req.params.id, profile_id: req.user.id });
  if (!attempt) { res.status(404).json({ error: 'Attempt not found.' }); return null; }
  return attempt;
};

const sheetFrom = async (attempt: Record<string, any>, exam: Record<string, any>): Promise<ExamSheet> => {
  const snapshot: Snapshot[] = attempt.question_snapshot_json || [];
  const session = await db.one('sessions', { id: exam.session_id });
  const variant = await db.one('exam_variants', { id: attempt.variant_id });
  return {
    attemptId: attempt.id, examId: exam.id, title: exam.title,
    sessionTitle: session?.title ?? '', variantLabel: variant?.label ?? `Variant ${String.fromCharCode(65 + attempt.variant_index)}`,
    variantIndex: attempt.variant_index, startedAt: attempt.started_at, endsAt: attempt.ends_at,
    minutes: exam.minutes, passMark: exam.pass_mark, practicalPass: exam.practical_pass,
    requiresCode: !!exam.requires_code,
    // Deliberately no correct answers, explanations, rubrics or hidden tests.
    questions: snapshot.map(publicQuestion),
    answers: attempt.answers_json || {},
    integrityNotice: 'This is an active examination. Answers, hints and test cases are not shown. Leaving to study will invalidate this attempt and discard your in-progress answers; the next attempt will use a different variant.',
  } as ExamSheet & { answers: Record<string, string> };
};

examRouter.get('/:examId/available', async (req, res) => {
  const gate = await canStartExam((req as AuthedRequest).user.id, req.params.examId);
  res.json({ available: gate.ok, reason: gate.ok ? null : gate.reason, activeAttemptId: (gate as any).activeAttemptId ?? null });
});

examRouter.post('/:examId/start', async (req, res) => {
  const user = (req as AuthedRequest).user;
  const examId = req.params.examId;
  const exam = await db.one('exams', { id: examId });
  if (!exam) return res.status(404).json({ error: 'Examination not found.' });

  // Resume an already-active attempt instead of creating a second one.
  const existing = await db.one('exam_attempts', { profile_id: user.id, exam_id: examId, status: 'active' });
  if (existing) return res.json(await sheetFrom(existing, exam));

  const gate = await canStartExam(user.id, examId);
  if (!gate.ok) return res.status(403).json({ error: gate.reason });

  const variants = await db.all('exam_variants', { where: { exam_id: examId }, order: { column: 'variant_index' } });
  if (!variants.length) return res.status(503).json({ error: 'No examination variants have been published yet.' });
  const allAttempts = await db.all('exam_attempts', { where: { profile_id: user.id, exam_id: examId }, order: { column: 'started_at', dir: 'desc' } });
  const setting = await db.one('settings', { key: `cursor:${examId}` });
  let cursor = Number(setting?.value ?? 0);
  let variantIndex = cursor % variants.length;
  const last = allAttempts[0];
  if (last && Number(last.variant_index) === variantIndex) variantIndex = (variantIndex + 1) % variants.length;
  const variant = variants.find(v => Number(v.variant_index) === variantIndex) || variants[0];

  const ids: string[] = variant.question_ids_json || [];
  const rows = await db.all('question_bank', { where: { id: { op: 'in', value: ids }, approved: 1, published: 1 } });
  const byId = Object.fromEntries(rows.map(r => [r.id, r]));
  const seed = Number(variant.seed) + Date.now() % 100000;
  const snapshot = ids.map(id => byId[id]).filter(Boolean).map(row => renderQuestion(row, variantIndex, seed, variant.label));
  if (!snapshot.length) return res.status(503).json({ error: 'This variant has no published questions.' });

  const started = now();
  const ends = new Date(Date.now() + Number(exam.minutes) * 60000).toISOString();
  const attempt = await db.insert('exam_attempts', {
    id: randomId(), profile_id: user.id, exam_id: examId, variant_id: variant.id,
    variant_index: variantIndex, status: 'active', started_at: started, ends_at: ends,
    submitted_at: null, score: null, practical_score: null, passed: 0,
    manual_review: exam.manual_review ? 1 : 0,
    answers_json: {}, question_snapshot_json: snapshot, grades_json: null,
    reviewed_by: null, reviewed_at: null,
  });
  await db.update('settings', { key: `cursor:${examId}` }, { value: String(variantIndex + 1) });
  if (!setting) await db.insert('settings', { key: `cursor:${examId}`, value: String(variantIndex + 1) });
  res.json(await sheetFrom(attempt, exam));
});

examRouter.get('/attempt/:id', async (req, res) => {
  const attempt = await ownedAttempt(req as AuthedRequest, res);
  if (!attempt) return;
  if (attempt.status !== 'active') return res.status(410).json({ error: 'This attempt is no longer active.' });
  const exam = await db.one('exams', { id: attempt.exam_id });
  res.json(await sheetFrom(attempt, exam!));
});

examRouter.post('/attempt/:id/answer', async (req, res) => {
  const attempt = await ownedAttempt(req as AuthedRequest, res);
  if (!attempt) return;
  if (attempt.status !== 'active') return res.status(410).json({ error: 'This attempt is no longer active.' });
  const { answers } = req.body || {};
  if (!answers || typeof answers !== 'object') return res.status(400).json({ error: 'Invalid answers.' });
  const clean: Record<string, string> = {};
  for (const q of (attempt.question_snapshot_json || []) as Snapshot[]) {
    if (typeof answers[q.id] === 'string') clean[q.id] = answers[q.id].slice(0, 20000);
  }
  await db.update('exam_attempts', { id: attempt.id }, { answers_json: clean });
  res.json({ ok: true, saved: Object.keys(clean).length });
});

/** "Run" executes ONLY visible tests in the isolated worker. Hidden tests are
 *  never sent to the client and are only used at grading time. */
examRouter.post('/attempt/:id/run', async (req, res) => {
  const attempt = await ownedAttempt(req as AuthedRequest, res);
  if (!attempt) return;
  if (attempt.status !== 'active') return res.status(410).json({ error: 'This attempt is no longer active.' });
  const { questionId, code } = req.body || {};
  const q = ((attempt.question_snapshot_json || []) as Snapshot[]).find(x => x.id === questionId);
  if (!q || q.type !== 'coding') return res.status(400).json({ error: 'No runnable task found.' });
  if (typeof code !== 'string') return res.status(400).json({ error: 'No code supplied.' });
  const result = await runJavaScript(code, q.visibleTests);
  res.json({ results: result.results, logs: result.logs, error: result.error ?? null });
});

examRouter.post('/attempt/:id/submit', async (req, res) => {
  const attempt = await ownedAttempt(req as AuthedRequest, res);
  if (!attempt) return;
  if (attempt.status !== 'active') return res.status(410).json({ error: 'This attempt has already been submitted or abandoned.' });
  const exam = await db.one('exams', { id: attempt.exam_id });
  if (!exam) return res.status(404).json({ error: 'Examination not found.' });
  const snapshot = (attempt.question_snapshot_json || []) as Snapshot[];
  const incoming = (req.body?.answers && typeof req.body.answers === 'object') ? req.body.answers : attempt.answers_json || {};
  const clean: Record<string, string> = {};
  for (const q of snapshot) clean[q.id] = typeof incoming[q.id] === 'string' ? incoming[q.id].slice(0, 20000) : '';

  const outcome = await gradeAttempt(attempt, clean, snapshot);
  const passMark = Number(exam.pass_mark);
  const practicalPass = Number(exam.practical_pass);
  const practicalOk = outcome.practicalScore === null || outcome.practicalScore >= practicalPass;
  const autoPass = outcome.score >= passMark && practicalOk;
  const manualReview = !!exam.manual_review;
  const status = manualReview ? 'awaiting_review' : 'graded';
  const passed = manualReview ? false : autoPass;

  await db.update('exam_attempts', { id: attempt.id }, {
    status, submitted_at: now(), score: outcome.score, practical_score: outcome.practicalScore,
    passed: passed ? 1 : 0, answers_json: clean, grades_json: outcome.grades,
  });

  if (!manualReview) {
    await db.insert('notifications', {
      id: randomId(), profile_id: attempt.profile_id, kind: 'exam',
      message: autoPass
        ? `You passed ${exam.title} with ${outcome.score}%. The next session is unlocked.`
        : `${exam.title} was not passed (${outcome.score}%). Revisit the lessons and try another variant.`,
      read: 0, related_id: attempt.id, created_at: now(),
    });
    if (autoPass) await syncAchievements(attempt.profile_id);
  } else {
    await db.insert('notifications', {
      id: randomId(), profile_id: attempt.profile_id, kind: 'exam',
      message: `${exam.title} was submitted for instructor review. Your written score: ${outcome.score}%.`,
      read: 0, related_id: attempt.id, created_at: now(),
    });
  }

  const result: ExamResult = {
    attemptId: attempt.id, score: outcome.score, practicalScore: outcome.practicalScore,
    passMark, practicalPass, passed, gradedAt: now(), grades: outcome.grades,
    variantLabel: `Variant ${String.fromCharCode(65 + Number(attempt.variant_index))}`,
    canRetake: !passed, nextSessionUnlocked: passed,
  };
  res.json({ ...result, awaitingInstructorReview: manualReview });
});

/** Strict rule: leaving an active exam for the lessons invalidates THIS
 *  attempt, discards its in-progress answers, keeps all completed lessons and
 *  past history, and forces a different variant next time. */
examRouter.post('/attempt/:id/abandon', async (req, res) => {
  const attempt = await ownedAttempt(req as AuthedRequest, res);
  if (!attempt) return;
  if (attempt.status !== 'active') return res.json({ ok: true, alreadyClosed: true });
  await db.update('exam_attempts', { id: attempt.id }, {
    status: 'abandoned', answers_json: {}, question_snapshot_json: [],
    grades_json: null, score: null, practical_score: null, passed: 0, submitted_at: now(),
  });
  const setting = await db.one('settings', { key: `cursor:${attempt.exam_id}` });
  await db.update('settings', { key: `cursor:${attempt.exam_id}` }, { value: String(Number(setting?.value ?? 0) + 1) });
  res.json({ ok: true, discardedAnswers: true, differentVariantNext: true });
});

examRouter.get('/attempt/:id/result', async (req, res) => {
  const attempt = await ownedAttempt(req as AuthedRequest, res);
  if (!attempt) return;
  if (attempt.status === 'active') return res.status(409).json({ error: 'Submit the examination first.' });
  const exam = await db.one('exams', { id: attempt.exam_id });
  const result: ExamResult = {
    attemptId: attempt.id, score: Number(attempt.score ?? 0),
    practicalScore: attempt.practical_score === null ? null : Number(attempt.practical_score),
    passMark: Number(exam?.pass_mark ?? 80), practicalPass: Number(exam?.practical_pass ?? 0),
    passed: !!attempt.passed, gradedAt: attempt.submitted_at ?? now(),
    grades: attempt.grades_json || [],
    variantLabel: `Variant ${String.fromCharCode(65 + Number(attempt.variant_index))}`,
    canRetake: !attempt.passed, nextSessionUnlocked: !!attempt.passed,
  };
  res.json({ ...result, status: attempt.status, awaitingInstructorReview: attempt.status === 'awaiting_review' });
});

examRouter.get('/history/all', async (req, res) => {
  const user = (req as AuthedRequest).user;
  const rows = await db.all('exam_attempts', { where: { profile_id: user.id }, order: { column: 'started_at', dir: 'desc' } });
  res.json({ attempts: await Promise.all(rows.map(attemptView)) });
});
