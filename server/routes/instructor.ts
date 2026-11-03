import { Router } from 'express';
import { requireUser, requireRole, audit } from '../auth';
import type { AuthedRequest } from '../auth';
import { db } from '../db';
import { now, randomId } from '../env';
import { computeUnlocks, attemptView, helpView, studentProfile } from '../services';
import { variantQuestionIds } from '../seed';
import { EXAM_CONFIGS } from '../../shared/exams';
import type { InstructorOverview, QuestionBankItem } from '../../shared/types';

export const instructorRouter = Router();
instructorRouter.use(requireUser, requireRole('instructor'));

const auditIt = (req: AuthedRequest, action: string, target?: string, detail?: unknown) =>
  audit(req.user.id, action, target, detail);

instructorRouter.get('/overview', async (_req, res) => {
  const student = await studentProfile();
  if (!student) return res.status(404).json({ error: 'Student account not found.' });
  const [info, attempts, helps, videos, subtitles] = await Promise.all([
    computeUnlocks(student.id),
    db.all('exam_attempts', { where: { profile_id: student.id }, order: { column: 'started_at', dir: 'desc' } }),
    db.all('help_requests', { where: { profile_id: student.id } }),
    db.all('video_resources', {}),
    db.all('subtitle_files', {}),
  ]);
  const views = await Promise.all(attempts.filter(a => a.status !== 'abandoned').map(attemptView));
  const graded = attempts.filter(a => a.grades_json && Array.isArray(a.grades_json));
  const byObjective: Record<string, { objective: string; sessionTitle: string; correct: number; total: number }> = {};
  for (const a of graded) {
    const session = await db.one('sessions', { id: (await db.one('exams', { id: a.exam_id }))?.session_id ?? '' });
    const snapshot: any[] = a.question_snapshot_json || [];
    const objectiveById = Object.fromEntries(snapshot.map(q => [q.id, q.objective]));
    for (const g of a.grades_json as any[]) {
      const objective = objectiveById[g.questionId] || 'General';
      const key = `${session?.id ?? ''}:${objective}`;
      byObjective[key] = byObjective[key] || { objective, sessionTitle: session?.title ?? '', correct: 0, total: 0 };
      byObjective[key].total += 1;
      if (g.correct) byObjective[key].correct += 1;
    }
  }
  const lessons = await db.all('lessons', { order: { column: 'order_index' } });
  const progress = await db.all('lesson_progress', { where: { profile_id: student.id } });
  const done = new Set(progress.map(p => p.lesson_id));
  const current = info.states.find(s => s.state === 'active');
  const nextLesson = current ? lessons.find(l => l.session_id === current.id && !done.has(l.id)) : null;
  const captioned = new Set(subtitles.filter(s => s.checked && (s.caption_status === 'checked' || s.caption_status === 'published')).map(s => s.lesson_id));
  const lessonsWithVideos = new Set(videos.map(v => v.lesson_id));

  const payload: InstructorOverview = {
    student: { displayName: student.display_name, accountId: student.account_id, joinedAt: student.created_at, lastActiveAt: student.last_active_at },
    overallPercent: info.lessonsTotal ? Math.round((info.lessonsCompleted / info.lessonsTotal) * 100) : 0,
    lessonsCompleted: info.lessonsCompleted, lessonsTotal: info.lessonsTotal,
    completedSessions: info.sessionsCompleted, currentSession: current?.title ?? null,
    currentLesson: nextLesson?.title ?? null,
    attempts: views, failedAttempts: views.filter(a => a.status === 'graded' && !a.passed),
    strugglingAreas: Object.values(byObjective)
      .filter(o => o.correct / o.total < 0.7)
      .sort((a, b) => (a.correct / a.total) - (b.correct / b.total)).slice(0, 8),
    helpPending: helps.filter(h => h.status === 'pending').length,
    videosWithoutCaptions: [...lessonsWithVideos].filter(id => !captioned.has(id)).length,
    unverifiedVideos: videos.filter(v => v.metadata_status !== 'verified').length,
  };
  res.json(payload);
});

instructorRouter.get('/curriculum', async (_req, res) => {
  const [sessions, lessons, videos, subtitles, assets, exams] = await Promise.all([
    db.all('sessions', { order: { column: 'order_index' } }),
    db.all('lessons', { order: { column: 'order_index' } }),
    db.all('video_resources', {}), db.all('subtitle_files', {}),
    db.all('lesson_assets', {}), db.all('exams', {}),
  ]);
  res.json({
    sessions: sessions.map(s => ({
      ...s,
      lessons: lessons.filter(l => l.session_id === s.id).map(l => ({
        ...l,
        videos: videos.filter(v => v.lesson_id === l.id),
        subtitles: subtitles.filter(t => t.lesson_id === l.id),
        assets: assets.filter(a => a.lesson_id === l.id),
      })),
      exam: exams.find(e => e.session_id === s.id) ?? null,
    })),
  });
});

instructorRouter.post('/sessions', async (req, res) => {
  const body = req.body || {};
  if (!body.title || typeof body.title !== 'string') return res.status(400).json({ error: 'A session title is required.' });
  const count = (await db.all('sessions', {})).length;
  const id = `s-custom-${randomId().slice(0, 8)}`;
  const row = await db.insert('sessions', {
    id, order_index: Number.isFinite(Number(body.order_index)) ? Number(body.order_index) : count,
    slug: id, title: body.title, subtitle: body.subtitle || 'New session', description: body.description || '',
    minutes: Number(body.minutes) || 120, project_json: body.project || {}, published: body.published === false ? 0 : 1,
    created_at: now(), updated_at: now(),
  });
  await auditIt(req as AuthedRequest, 'session.add', id);
  res.json({ session: row });
});

instructorRouter.patch('/sessions/:id', async (req, res) => {
  const patch: Record<string, unknown> = { updated_at: now() };
  for (const key of ['title', 'subtitle', 'description']) if (typeof req.body?.[key] === 'string') patch[key] = req.body[key];
  for (const key of ['minutes', 'order_index']) if (Number.isFinite(Number(req.body?.[key]))) patch[key] = Number(req.body[key]);
  if (typeof req.body?.published === 'boolean') patch.published = req.body.published ? 1 : 0;
  if (req.body?.project && typeof req.body.project === 'object') patch.project_json = req.body.project;
  await db.update('sessions', { id: req.params.id }, patch);
  await auditIt(req as AuthedRequest, 'session.edit', req.params.id, patch);
  res.json({ ok: true });
});

instructorRouter.post('/lessons', async (req, res) => {
  const body = req.body || {};
  if (!body.sessionId || !await db.one('sessions', { id: body.sessionId })) return res.status(404).json({ error: 'Session not found.' });
  if (!body.title || typeof body.title !== 'string') return res.status(400).json({ error: 'A lesson title is required.' });
  const siblings = await db.all('lessons', { where: { session_id: body.sessionId } });
  const slug = String(body.slug || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).slice(0, 60);
  const emptyContent = {
    title: body.title, whatYouWillLearn: [], whyItMatters: '', explanation: [], stepByStep: [],
    examples: [], codeSnippets: [], lineByLine: [], commonMistakes: [],
    practicalExercise: { title: 'Practice', brief: '', steps: [], successChecks: [] },
    knowledgeCheck: [], recap: [],
  };
  const row = await db.insert('lessons', {
    id: randomId(), session_id: body.sessionId, slug, order_index: siblings.length,
    title: body.title, minutes: Number(body.minutes) || 20,
    content_json: body.content || emptyContent, topics_json: body.topics || [],
    published: body.published === false ? 0 : 1, updated_at: now(),
  });
  await auditIt(req as AuthedRequest, 'lesson.add', row.id);
  res.json({ lesson: row });
});

instructorRouter.patch('/lessons/:id', async (req, res) => {
  const lesson = await db.one('lessons', { id: req.params.id });
  if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });
  const patch: Record<string, unknown> = { updated_at: now() };
  if (typeof req.body?.title === 'string') {
    patch.title = req.body.title;
    // The lesson reader displays content_json.title. Keep both in sync so an
    // instructor rename is immediately visible to the student.
    patch.content_json = { ...(lesson.content_json || {}), title: req.body.title };
  }
  if (Number.isFinite(Number(req.body?.minutes))) patch.minutes = Number(req.body.minutes);
  if (Number.isFinite(Number(req.body?.order_index))) patch.order_index = Number(req.body.order_index);
  if (typeof req.body?.published === 'boolean') patch.published = req.body.published ? 1 : 0;
  if (req.body?.content && typeof req.body.content === 'object') {
    patch.content_json = { ...(lesson.content_json || {}), ...req.body.content, title: req.body.content.title || lesson.title };
  }
  if (Array.isArray(req.body?.topics)) patch.topics_json = req.body.topics;
  await db.update('lessons', { id: req.params.id }, patch);
  await auditIt(req as AuthedRequest, 'lesson.edit', req.params.id, Object.keys(patch));
  res.json({ ok: true });
});

instructorRouter.post('/lessons/reorder', async (req, res) => {
  const { sessionId, orderedIds } = req.body || {};
  if (!sessionId || !Array.isArray(orderedIds)) return res.status(400).json({ error: 'sessionId and orderedIds are required.' });
  for (const [i, id] of orderedIds.entries()) await db.update('lessons', { id, session_id: sessionId }, { order_index: i, updated_at: now() });
  await auditIt(req as AuthedRequest, 'lesson.reorder', sessionId, orderedIds);
  res.json({ ok: true });
});

instructorRouter.get('/exams', async (_req, res) => {
  const [exams, sessions, variants] = await Promise.all([db.all('exams', {}), db.all('sessions', {}), db.all('exam_variants', {})]);
  res.json({
    exams: exams.map(e => ({ ...e, sessionTitle: sessions.find(s => s.id === e.session_id)?.title ?? '', variants: variants.filter(v => v.exam_id === e.id).length })),
    defaults: EXAM_CONFIGS,
  });
});

instructorRouter.patch('/exams/:id', async (req, res) => {
  const patch: Record<string, unknown> = { updated_at: now() };
  for (const key of ['title', 'brief']) if (typeof req.body?.[key] === 'string') patch[key] = req.body[key];
  for (const key of ['minutes', 'pass_mark', 'practical_pass', 'question_count']) if (Number.isFinite(Number(req.body?.[key]))) patch[key] = Number(req.body[key]);
  for (const key of ['published', 'requires_code', 'manual_review']) if (typeof req.body?.[key] === 'boolean') patch[key] = req.body[key] ? 1 : 0;
  await db.update('exams', { id: req.params.id }, patch);
  await auditIt(req as AuthedRequest, 'exam.edit', req.params.id, patch);
  res.json({ ok: true });
});

const questionItem = (row: Record<string, any>): QuestionBankItem => ({
  id: row.id, examId: row.exam_id, variantGroup: row.objective, type: row.type,
  prompt: row.prompt, points: Number(row.points), difficulty: row.difficulty,
  objective: row.objective, approved: !!row.approved, published: !!row.published,
  hasHiddenTests: Array.isArray(row.hidden_tests_json) && row.hidden_tests_json.length > 0,
  updatedAt: row.updated_at, correctAnswer: row.options_json?.[row.correct_index] ?? row.explanation,
  explanation: row.explanation, options: row.options_json ?? undefined,
  hiddenTests: row.hidden_tests_json ?? undefined,
  taskInstructions: row.task_instructions ?? undefined, starterCode: row.starter_code ?? undefined,
});

instructorRouter.get('/questions', async (req, res) => {
  const where: Record<string, string> = req.query.examId ? { exam_id: String(req.query.examId) } : {};
  const rows = await db.all('question_bank', { where, order: { column: 'id' } });
  res.json({ questions: rows.map(questionItem) });
});

instructorRouter.post('/questions', async (req, res) => {
  const body = req.body || {};
  if (!body.examId || !await db.one('exams', { id: body.examId })) return res.status(404).json({ error: 'Exam not found.' });
  if (!body.prompt || typeof body.prompt !== 'string') return res.status(400).json({ error: 'Question prompt is required.' });
  const row = await db.insert('question_bank', {
    id: `q-custom-${randomId().slice(0, 8)}`, exam_id: body.examId,
    objective: body.objective || 'General', type: body.type || 'mcq',
    difficulty: body.difficulty || 'applied', points: Number(body.points) || 5,
    prompt: body.prompt, variants_json: body.variants || [{}],
    options_json: body.options ?? null, correct_index: Number(body.correctIndex) || 0,
    rubric_json: body.rubric ?? null, explanation: body.explanation || '',
    approved: body.approved === true ? 1 : 0, published: body.published === true ? 1 : 0,
    language: body.language ?? null, starter_code: body.starterCode ?? null,
    task_instructions: body.taskInstructions ?? null, context_code: body.contextCode ?? null,
    visible_tests_json: body.visibleTests ?? null, hidden_tests_json: body.hiddenTests ?? null,
    static_checks_json: body.staticChecks ?? null, updated_at: now(),
  });
  await auditIt(req as AuthedRequest, 'question.add', row.id);
  res.json({ question: questionItem(row) });
});

instructorRouter.patch('/questions/:id', async (req, res) => {
  const row = await db.one('question_bank', { id: req.params.id });
  if (!row) return res.status(404).json({ error: 'Question not found.' });
  const patch: Record<string, unknown> = { updated_at: now() };
  const textFields: Record<string, string> = { prompt: 'prompt', explanation: 'explanation', objective: 'objective', type: 'type', difficulty: 'difficulty', language: 'language', starterCode: 'starter_code', taskInstructions: 'task_instructions', contextCode: 'context_code' };
  for (const [bodyKey, col] of Object.entries(textFields)) if (typeof req.body?.[bodyKey] === 'string') patch[col] = req.body[bodyKey];
  const jsonFields: Record<string, string> = { variants: 'variants_json', options: 'options_json', rubric: 'rubric_json', visibleTests: 'visible_tests_json', hiddenTests: 'hidden_tests_json', staticChecks: 'static_checks_json' };
  for (const [bodyKey, col] of Object.entries(jsonFields)) if (req.body?.[bodyKey] !== undefined) patch[col] = req.body[bodyKey];
  for (const key of ['points', 'correct_index']) if (Number.isFinite(Number(req.body?.[key === 'correct_index' ? 'correctIndex' : key]))) patch[key] = Number(req.body[key === 'correct_index' ? 'correctIndex' : key]);
  for (const key of ['approved', 'published']) if (typeof req.body?.[key] === 'boolean') patch[key] = req.body[key] ? 1 : 0;
  await db.update('question_bank', { id: row.id }, patch);
  await auditIt(req as AuthedRequest, 'question.edit', row.id, Object.keys(patch));
  res.json({ ok: true });
});

instructorRouter.post('/variants/:examId/regenerate', async (req, res) => {
  const exam = await db.one('exams', { id: req.params.examId });
  if (!exam) return res.status(404).json({ error: 'Exam not found.' });
  const questions = await db.all('question_bank', { where: { exam_id: exam.id, approved: 1, published: 1 } });
  await db.remove('exam_variants', { exam_id: exam.id });
  for (let v = 0; v < 3; v++) {
    await db.insert('exam_variants', {
      id: randomId(), exam_id: exam.id, label: `Variant ${String.fromCharCode(65 + v)}`,
      variant_index: v, seed: Math.floor(Math.random() * 2 ** 31),
      question_ids_json: variantQuestionIds(questions, v, exam.question_count, !!exam.requires_code),
    });
  }
  await auditIt(req as AuthedRequest, 'variants.regenerate', exam.id, { count: questions.length });
  res.json({ ok: true, questions: questions.length });
});

instructorRouter.get('/attempts', async (_req, res) => {
  const rows = await db.all('exam_attempts', { order: { column: 'started_at', dir: 'desc' } });
  res.json({ attempts: await Promise.all(rows.map(attemptView)) });
});

instructorRouter.get('/attempts/:id', async (req, res) => {
  const attempt = await db.one('exam_attempts', { id: req.params.id });
  if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });
  const [submissions, testResults, exam, profile] = await Promise.all([
    db.all('submissions', { where: { attempt_id: attempt.id } }),
    db.all('coding_test_results', { where: { attempt_id: attempt.id } }),
    db.one('exams', { id: attempt.exam_id }),
    db.one('profiles', { id: attempt.profile_id }),
  ]);
  res.json({
    attempt: await attemptView(attempt), examTitle: exam?.title ?? '',
    studentName: profile?.display_name ?? '',
    grades: attempt.grades_json || [], answers: attempt.answers_json || {},
    submissions: submissions.map(s => ({ ...s, testResults: testResults.filter(t => t.submission_id === s.id) })),
    canApprove: !!exam?.manual_review && attempt.status === 'awaiting_review',
  });
});

instructorRouter.post('/attempts/:id/reset', async (req, res) => {
  const attempt = await db.one('exam_attempts', { id: req.params.id });
  if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });
  const hard = req.body?.mode === 'delete';
  if (hard) {
    const submissions = await db.all('submissions', { where: { attempt_id: attempt.id } });
    for (const s of submissions) await db.remove('coding_test_results', { submission_id: s.id });
    await db.remove('submissions', { attempt_id: attempt.id });
    await db.remove('exam_attempts', { id: attempt.id });
  } else {
    await db.update('exam_attempts', { id: attempt.id }, {
      status: 'abandoned', score: null, practical_score: null, passed: 0,
      answers_json: {}, grades_json: null, question_snapshot_json: [],
      reviewed_by: null, reviewed_at: null, submitted_at: now(),
    });
  }
  await auditIt(req as AuthedRequest, 'attempt.reset', attempt.id, { mode: hard ? 'delete' : 'invalidate' });
  res.json({ ok: true, mode: hard ? 'deleted' : 'invalidated' });
});

instructorRouter.post('/attempts/:id/approve', async (req, res) => {
  const attempt = await db.one('exam_attempts', { id: req.params.id });
  if (!attempt) return res.status(404).json({ error: 'Attempt not found.' });
  if (attempt.status !== 'awaiting_review') return res.status(400).json({ error: 'Only a submitted capstone awaiting review can be approved.' });
  const user = (req as AuthedRequest).user;
  await db.update('exam_attempts', { id: attempt.id }, {
    status: 'graded', passed: 1, reviewed_by: user.id, reviewed_at: now(),
  });
  await db.insert('notifications', {
    id: randomId(), profile_id: attempt.profile_id, kind: 'exam',
    message: 'Your capstone demonstration has been approved by Ace.', read: 0,
    related_id: attempt.id, created_at: now(),
  });
  await auditIt(req as AuthedRequest, 'attempt.approve', attempt.id, req.body?.note || null);
  res.json({ ok: true });
});

instructorRouter.get('/help', async (_req, res) => {
  const rows = await db.all('help_requests', { order: { column: 'created_at', dir: 'desc' } });
  res.json({ questions: await Promise.all(rows.map(helpView)) });
});

instructorRouter.post('/help/:id/reply', async (req, res) => {
  const row = await db.one('help_requests', { id: req.params.id });
  if (!row) return res.status(404).json({ error: 'Request not found.' });
  const answer = typeof req.body?.answer === 'string' ? req.body.answer.trim() : '';
  if (answer.length < 2) return res.status(400).json({ error: 'Write a reply first.' });
  const user = (req as AuthedRequest).user;
  await db.update('help_requests', { id: row.id }, {
    answer, status: 'answered', answered_at: now(), answered_by: user.id, answered_via: 'in_app',
  });
  await db.insert('notifications', {
    id: randomId(), profile_id: row.profile_id, kind: 'answer',
    message: 'Ace replied to your question: ' + answer.slice(0, 90), read: 0,
    related_id: row.id, created_at: now(),
  });
  await auditIt(req as AuthedRequest, 'help.reply', row.id);
  res.json({ ok: true });
});

/** For answers given through WhatsApp: the site does NOT pretend to detect
 *  WhatsApp messages. Ace records the outcome manually. */
instructorRouter.post('/help/:id/mark-answered', async (req, res) => {
  const row = await db.one('help_requests', { id: req.params.id });
  if (!row) return res.status(404).json({ error: 'Request not found.' });
  const summary = typeof req.body?.summary === 'string' ? req.body.summary.trim() : '';
  const user = (req as AuthedRequest).user;
  await db.update('help_requests', { id: row.id }, {
    status: 'answered', answer: summary || null, answered_at: now(),
    answered_by: user.id, answered_via: 'whatsapp',
  });
  await db.insert('notifications', {
    id: randomId(), profile_id: row.profile_id, kind: 'answer',
    message: summary ? 'Ace marked your WhatsApp answer as answered: ' + summary.slice(0, 90) : 'Ace marked your question as answered on WhatsApp.',
    read: 0, related_id: row.id, created_at: now(),
  });
  await auditIt(req as AuthedRequest, 'help.mark-answered', row.id, { via: 'whatsapp' });
  res.json({ ok: true });
});

instructorRouter.get('/student', async (_req, res) => {
  const student = await studentProfile();
  if (!student) return res.status(404).json({ error: 'Student not found.' });
  const [info, attempts, progress] = await Promise.all([
    computeUnlocks(student.id),
    db.all('exam_attempts', { where: { profile_id: student.id }, order: { column: 'started_at', dir: 'desc' } }),
    db.all('lesson_progress', { where: { profile_id: student.id }, order: { column: 'completed_at', dir: 'desc' } }),
  ]);
  res.json({
    student: { displayName: student.display_name, accountId: student.account_id, joinedAt: student.created_at },
    sessions: info.states, attempts: await Promise.all(attempts.map(attemptView)),
    lessonProgress: progress,
  });
});
