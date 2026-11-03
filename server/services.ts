import { db } from './db';
import { env, now, randomId } from './env';
import { examIdFor } from '../shared/curriculum';
import type { SessionSummary, HelpRequestView, AttemptSummary, ProjectBrief } from '../shared/types';

export const studentProfile = async () => db.one('profiles', { role: 'student' });

export interface UnlockInfo {
  states: SessionSummary[];
  byId: Record<string, SessionSummary>;
  lessonsCompleted: number;
  lessonsTotal: number;
  sessionsCompleted: number;
}

/** Sequential unlocking is computed SERVER-SIDE on every request. Changing a
 *  URL cannot skip ahead: a locked session's lessons and exams return 403. */
export async function computeUnlocks(profileId: string): Promise<UnlockInfo> {
  const sessions = await db.all('sessions', { order: { column: 'order_index' } });
  const lessons = await db.all('lessons', { order: { column: 'order_index' } });
  const progress = await db.all('lesson_progress', { where: { profile_id: profileId } });
  const attempts = await db.all('exam_attempts', { where: { profile_id: profileId } });
  const done = new Set(progress.map(p => p.lesson_id));

  const states: SessionSummary[] = [];
  let previousPassed = true;   // Session 0 is always available
  let previousComplete = true;
  let previousTitle = '';

  for (const s of sessions) {
    const sessionLessons = lessons.filter(l => l.session_id === s.id && l.published);
    const completed = sessionLessons.filter(l => done.has(l.id)).length;
    const examId = examIdFor(s.id);
    const examAttempts = attempts.filter(a => a.exam_id === examId && a.status !== 'abandoned');
    const passedAttempts = examAttempts.filter(a => a.passed);
    const best = examAttempts.length
      ? Math.max(...examAttempts.map(a => Number(a.score ?? 0))) : null;

    const unlocked = previousPassed && previousComplete;
    const sessionPassed = passedAttempts.length > 0;
    const allLessonsComplete = sessionLessons.length > 0 && completed >= sessionLessons.length;
    const state: SessionSummary['state'] = !unlocked ? 'locked'
      : (sessionPassed && allLessonsComplete) ? 'completed' : 'active';

    states.push({
      id: s.id, orderIndex: s.order_index, title: s.title, subtitle: s.subtitle,
      description: s.description, state, lessonCount: sessionLessons.length,
      lessonsCompleted: completed, examPassed: sessionPassed,
      examAttempts: examAttempts.length, bestScore: best === null ? null : Number(best.toFixed(1)),
      unlockReason: unlocked
        ? 'Available'
        : `Complete every lesson in ${previousTitle || 'the previous session'} and pass its examination first.`,
    });
    previousPassed = sessionPassed;
    previousComplete = allLessonsComplete;
    previousTitle = s.title;
  }

  return {
    states, byId: Object.fromEntries(states.map(s => [s.id, s])),
    lessonsCompleted: progress.length,
    lessonsTotal: lessons.filter(l => l.published).length,
    sessionsCompleted: states.filter(s => s.state === 'completed').length,
  };
}

export async function canAccessLesson(profileId: string, lessonId: string) {
  const lesson = await db.one('lessons', { id: lessonId });
  if (!lesson) return { ok: false as const, reason: 'Lesson not found.' };
  const info = await computeUnlocks(profileId);
  const state = info.byId[lesson.session_id];
  if (!state || state.state === 'locked') {
    return { ok: false as const, reason: state?.unlockReason || 'This session is locked.' };
  }
  return { ok: true as const, lesson, state };
}

export async function canStartExam(profileId: string, examId: string) {
  const exam = await db.one('exams', { id: examId });
  if (!exam || !exam.published) return { ok: false as const, reason: 'This examination is not published.' };
  const info = await computeUnlocks(profileId);
  const state = info.byId[exam.session_id];
  if (!state || state.state === 'locked') {
    return { ok: false as const, reason: state?.unlockReason || 'This session is locked.' };
  }
  if (state.lessonsCompleted < state.lessonCount) {
    return { ok: false as const, reason: `Complete all ${state.lessonCount} lessons in this session before the examination (${state.lessonsCompleted}/${state.lessonCount} done).` };
  }
  const active = await db.one('exam_attempts', { profile_id: profileId, exam_id: examId, status: 'active' });
  if (active) return { ok: false as const, reason: 'You already have an active attempt.', activeAttemptId: active.id };
  return { ok: true as const, exam };
}

/** Achievements are derived from REAL records, never fabricated. */
export async function syncAchievements(profileId: string) {
  const info = await computeUnlocks(profileId);
  const attempts = await db.all('exam_attempts', { where: { profile_id: profileId, passed: 1 } });
  const possible: { key: string; title: string; detail: string; icon: string; earned: boolean }[] = [
    { key: 'first-lesson', title: 'First Steps', detail: 'Completed your very first lesson.', icon: '🌱', earned: info.lessonsCompleted >= 1 },
    { key: 'five-lessons', title: 'Getting Warmer', detail: 'Completed five lessons.', icon: '📗', earned: info.lessonsCompleted >= 5 },
    { key: 'fifteen-lessons', title: 'Serious Learner', detail: 'Completed fifteen lessons.', icon: '📚', earned: info.lessonsCompleted >= 15 },
    { key: 'first-exam', title: 'Exam Ready', detail: 'Passed your first examination.', icon: '🏅', earned: attempts.length >= 1 },
    { key: 'three-exams', title: 'On a Roll', detail: 'Passed three examinations.', icon: '🎯', earned: attempts.length >= 3 },
    { key: 'first-session', title: 'Session Cleared', detail: 'Fully completed a session.', icon: '🚀', earned: info.sessionsCompleted >= 1 },
  ];
  for (const a of possible) {
    if (!a.earned) continue;
    if (await db.one('achievements', { profile_id: profileId, key: a.key })) continue;
    await db.insert('achievements', {
      id: randomId(), profile_id: profileId, key: a.key, title: a.title,
      detail: a.detail, icon: a.icon, earned_at: now(),
    });
  }
  return db.all('achievements', { where: { profile_id: profileId }, order: { column: 'earned_at', dir: 'desc' } });
}

export const whatsappUrl = (payload: { session: string; lesson: string; question: string; requestId: string }) => {
  const message = [
    'Hello Ace, Daniella has a question.',
    '',
    `Session: ${payload.session}`,
    `Lesson: ${payload.lesson}`,
    `Question: ${payload.question}`,
    `Request ID: ${payload.requestId}`,
  ].join('\n');
  return `https://wa.me/${env.whatsappNumber}?text=${encodeURIComponent(message)}`;
};

export const helpView = async (row: Record<string, any>): Promise<HelpRequestView> => {
  const session = row.session_id ? await db.one('sessions', { id: row.session_id }) : null;
  const lesson = row.lesson_id ? await db.one('lessons', { id: row.lesson_id }) : null;
  const sessionTitle = session?.title ?? null;
  const lessonTitle = lesson?.title ?? null;
  return {
    id: row.id, question: row.question, status: row.status,
    sessionTitle, lessonTitle, sessionId: row.session_id ?? null, lessonId: row.lesson_id ?? null,
    createdAt: row.created_at, answeredAt: row.answered_at ?? null, answer: row.answer ?? null,
    answeredVia: row.answered_via ?? null,
    whatsappUrl: whatsappUrl({
      session: sessionTitle || 'Not specified', lesson: lessonTitle || 'Not specified',
      question: row.question, requestId: row.id,
    }),
  };
};

export const attemptView = async (row: Record<string, any>): Promise<AttemptSummary> => {
  const exam = await db.one('exams', { id: row.exam_id });
  const session = exam ? await db.one('sessions', { id: exam.session_id }) : null;
  return {
    id: row.id, examId: row.exam_id, examTitle: exam?.title ?? 'Examination',
    sessionTitle: session?.title ?? '', variantLabel: `Variant ${String.fromCharCode(65 + Number(row.variant_index ?? 0))}`,
    status: row.status, startedAt: row.started_at, submittedAt: row.submitted_at ?? null,
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    practicalScore: row.practical_score === null || row.practical_score === undefined ? null : Number(row.practical_score),
    passed: !!row.passed,
  };
};

export const projectOf = (row: Record<string, any> | null): ProjectBrief | null =>
  row?.project_json ?? null;
