import { Router } from 'express';
import { requireUser, requireRole } from '../auth';
import type { AuthedRequest } from '../auth';
import { db } from '../db';
import { now, randomId } from '../env';
import { examIdFor } from '../../shared/curriculum';
import { computeUnlocks, canAccessLesson, syncAchievements, helpView, attemptView, projectOf } from '../services';
import type { StudentLessonDetail, DashboardData } from '../../shared/types';

export const studentRouter = Router();
studentRouter.use(requireUser, requireRole('student'));

studentRouter.get('/dashboard', async (req, res) => {
  const user = (req as AuthedRequest).user;
  const info = await computeUnlocks(user.id);
  const [lessons, attempts, helps, notifications, achievements] = await Promise.all([
    db.all('lessons', { order: { column: 'order_index' } }),
    db.all('exam_attempts', { where: { profile_id: user.id }, order: { column: 'started_at', dir: 'desc' } }),
    db.all('help_requests', { where: { profile_id: user.id }, order: { column: 'created_at', dir: 'desc' } }),
    db.all('notifications', { where: { profile_id: user.id }, order: { column: 'created_at', dir: 'desc' }, limit: 20 }),
    syncAchievements(user.id),
  ]);
  const active = attempts.find(a => a.status === 'active');
  const activeExam = active ? await db.one('exams', { id: active.exam_id }) : null;
  const activeSession = activeExam ? await db.one('sessions', { id: activeExam.session_id }) : null;

  const current = info.states.find(s => s.state === 'active') ?? null;
  let currentLesson: DashboardData['currentLesson'] = null;
  if (current) {
    const progress = await db.all('lesson_progress', { where: { profile_id: user.id } });
    const done = new Set(progress.map(p => p.lesson_id));
    const next = lessons.find(l => l.session_id === current.id && l.published && !done.has(l.id));
    if (next) currentLesson = { id: next.id, title: next.title, sessionTitle: current.title };
  }

  const pending = await Promise.all(helps.filter(h => h.status === 'pending').map(helpView));
  const answered = await Promise.all(helps.filter(h => h.status === 'answered').map(helpView));
  const total = info.lessonsTotal || 1;

  const payload: DashboardData = {
    profile: { id: user.id, accountId: user.accountId, displayName: user.displayName, role: user.role, createdAt: user.createdAt },
    greetingName: user.displayName.split(' ')[0],
    overallPercent: Math.round((info.lessonsCompleted / total) * 100),
    lessonsCompleted: info.lessonsCompleted, lessonsTotal: info.lessonsTotal,
    sessionsCompleted: info.sessionsCompleted, sessionsTotal: info.states.length,
    currentSession: current, currentLesson,
    completedSessions: info.states.filter(s => s.state === 'completed'),
    upcomingSessions: info.states.filter(s => s.state === 'locked'),
    examinationStatus: info.states.map(s => {
      const examId = examIdFor(s.id);
      const list = attempts.filter(a => a.exam_id === examId && a.status !== 'abandoned');
      const inProgress = list.some(a => a.status === 'active');
      return {
        sessionTitle: s.title,
        status: s.examPassed ? 'passed' as const : inProgress ? 'in_progress' as const : list.length ? 'failed' as const : 'not_started' as const,
        bestScore: s.bestScore, attempts: s.examAttempts,
      };
    }),
    achievements: achievements.map(a => ({ id: a.id, title: a.title, detail: a.detail, icon: a.icon, earnedAt: a.earned_at })),
    pendingQuestions: pending, answeredQuestions: answered,
    notifications: notifications.map(n => ({ id: n.id, message: n.message, read: !!n.read, createdAt: n.created_at, kind: n.kind })),
    activeAttempt: active ? {
      id: active.id, examId: active.exam_id, sessionTitle: activeSession?.title ?? 'Examination',
      startedAt: active.started_at, endsAt: active.ends_at,
    } : null,
    sessions: info.states,
  };
  res.json(payload);
});

studentRouter.get('/sessions', async (req, res) => {
  const user = (req as AuthedRequest).user;
  const info = await computeUnlocks(user.id);
  res.json({ sessions: info.states });
});

studentRouter.get('/sessions/:id', async (req, res) => {
  const user = (req as AuthedRequest).user;
  const info = await computeUnlocks(user.id);
  const state = info.byId[req.params.id];
  if (!state) return res.status(404).json({ error: 'Session not found.' });
  if (state.state === 'locked') return res.status(403).json({ error: state.unlockReason });
  const [session, lessons, progress, exam, attempts] = await Promise.all([
    db.one('sessions', { id: req.params.id }),
    db.all('lessons', { where: { session_id: req.params.id }, order: { column: 'order_index' } }),
    db.all('lesson_progress', { where: { profile_id: user.id } }),
    db.one('exams', { id: examIdFor(req.params.id) }),
    db.all('exam_attempts', { where: { profile_id: user.id, exam_id: examIdFor(req.params.id) } }),
  ]);
  const done = new Set(progress.map(p => p.lesson_id));
  const real = attempts.filter(a => a.status !== 'abandoned');
  res.json({
    session: state,
    lessons: lessons.filter(l => l.published).map(l => ({
      id: l.id, slug: l.slug, title: l.title, orderIndex: l.order_index,
      minutes: l.minutes, completed: done.has(l.id), published: !!l.published,
    })),
    exam: exam && exam.published ? {
      id: exam.id, title: exam.title, minutes: exam.minutes, requiresCode: !!exam.requires_code,
      passed: real.some(a => a.passed),
      bestScore: real.length ? Math.max(...real.map(a => Number(a.score ?? 0))) : null,
      attempts: real.length,
    } : null,
    project: projectOf(session),
  });
});

studentRouter.get('/lessons/:id', async (req, res) => {
  const user = (req as AuthedRequest).user;
  const access = await canAccessLesson(user.id, req.params.id);
  if (!access.ok) return res.status(403).json({ error: access.reason });
  const lesson = access.lesson;
  const [progress, session, videos, subtitles, assets] = await Promise.all([
    db.one('lesson_progress', { profile_id: user.id, lesson_id: lesson.id }),
    db.one('sessions', { id: lesson.session_id }),
    db.all('video_resources', { where: { lesson_id: lesson.id }, order: { column: 'order_index' } }),
    db.all('subtitle_files', { where: { lesson_id: lesson.id } }),
    db.all('lesson_assets', { where: { lesson_id: lesson.id } }),
  ]);
  const content = lesson.content_json || {};
  const detail: StudentLessonDetail = {
    id: lesson.id, sessionId: lesson.session_id, slug: lesson.slug,
    orderIndex: lesson.order_index, minutes: lesson.minutes, published: !!lesson.published,
    topics: lesson.topics_json || [], updatedAt: lesson.updated_at,
    title: content.title || lesson.title,
    whatYouWillLearn: content.whatYouWillLearn || [], whyItMatters: content.whyItMatters || '',
    explanation: content.explanation || [], stepByStep: content.stepByStep || [],
    examples: content.examples || [], codeSnippets: content.codeSnippets || [],
    lineByLine: content.lineByLine || [], commonMistakes: content.commonMistakes || [],
    practicalExercise: content.practicalExercise || { title: '', brief: '', steps: [], successChecks: [] },
    knowledgeCheck: content.knowledgeCheck || [], recap: content.recap || [],
    completed: !!progress, completedAt: progress?.completed_at ?? null,
    videos: videos.map(v => ({
      id: v.id, lessonId: v.lesson_id, sessionId: v.session_id, youtubeUrl: v.youtube_url,
      videoId: v.video_id, playlistId: v.playlist_id, isPlaylist: !!v.is_playlist,
      title: v.title, channel: v.channel, thumbnailUrl: v.thumbnail_url,
      durationSeconds: v.duration_seconds, metadataStatus: v.metadata_status,
      metadataCheckedAt: v.metadata_checked_at, note: v.note, orderIndex: v.order_index, createdBy: v.created_by,
    })),
    // Only a checked/published independent English track is captioned.
    subtitles: subtitles.filter(s => s.checked && (s.caption_status === 'checked' || s.caption_status === 'published')).map(s => ({
      id: s.id, lessonId: s.lesson_id, videoId: s.video_id, language: s.language,
      fileName: s.file_name, storagePath: s.storage_path, vtt: s.vtt,
      checked: !!s.checked, checkedAt: s.checked_at, checkedBy: s.checked_by,
      captionStatus: s.caption_status, updatedAt: s.updated_at,
    })),
    assets: assets.map(a => ({ id: a.id, lessonId: a.lesson_id, kind: a.kind, title: a.title, url: a.url, createdAt: a.created_at })),
    sessionTitle: session?.title ?? '',
  };
  res.json(detail);
});

studentRouter.post('/lessons/:id/complete', async (req, res) => {
  const user = (req as AuthedRequest).user;
  const access = await canAccessLesson(user.id, req.params.id);
  if (!access.ok) return res.status(403).json({ error: access.reason });
  const existing = await db.one('lesson_progress', { profile_id: user.id, lesson_id: req.params.id });
  if (existing) return res.json({ ok: true, alreadyCompleted: true, completedAt: existing.completed_at });
  await db.insert('lesson_progress', {
    id: randomId(), profile_id: user.id, lesson_id: req.params.id, completed_at: now(),
  });
  await syncAchievements(user.id);
  const info = await computeUnlocks(user.id);
  res.json({ ok: true, alreadyCompleted: false, session: info.byId[access.lesson.session_id] });
});

studentRouter.get('/progress', async (req, res) => {
  const user = (req as AuthedRequest).user;
  const info = await computeUnlocks(user.id);
  const attempts = await db.all('exam_attempts', { where: { profile_id: user.id }, order: { column: 'started_at', dir: 'desc' } });
  res.json({
    sessions: info.states, achievements: await syncAchievements(user.id),
    attempts: await Promise.all(attempts.filter(a => a.status !== 'abandoned').map(attemptView)),
  });
});

studentRouter.get('/questions', async (req, res) => {
  const user = (req as AuthedRequest).user;
  const rows = await db.all('help_requests', { where: { profile_id: user.id }, order: { column: 'created_at', dir: 'desc' } });
  res.json({ questions: await Promise.all(rows.map(helpView)) });
});

studentRouter.post('/notifications/:id/read', async (req, res) => {
  const user = (req as AuthedRequest).user;
  await db.update('notifications', { id: req.params.id, profile_id: user.id }, { read: 1 });
  res.json({ ok: true });
});
