import { db } from './db';
import { env, now, randomId } from './env';
import { hashPassword } from './auth';
import { SESSIONS, buildLesson, lessonIdFor, examIdFor } from '../shared/curriculum';
import { QUESTION_BANK, EXAM_CONFIGS } from '../shared/exams';
import { SEED_VIDEOS } from '../shared/videos';
import type { Row } from './db';

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
const hashSeed = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  // Signed 32-bit: mulberry32() applies `seed |= 0` anyway, so the PRNG
  // sequence is identical, but the stored value now fits Postgres `integer`
  // (SQLite accepted the unsigned 0..4294967295 range, Postgres does not).
  return h | 0;
};

/** Deterministically choose a DIFFERENT question set for each variant. */
export function variantQuestionIds(questions: Row[], variantIndex: number, count: number, requiresCode: boolean): string[] {
  const sorted = [...questions].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!sorted.length) return [];
  const random = mulberry32(hashSeed(sorted[0].exam_id + ':' + variantIndex));
  const offset = (variantIndex * 3) % sorted.length;
  const rotated = [...sorted.slice(offset), ...sorted.slice(0, offset)];
  const picked = rotated.slice(0, Math.min(count, rotated.length));
  if (requiresCode && !picked.some(q => q.type === 'coding')) {
    const codeQ = rotated.find(q => q.type === 'coding');
    if (codeQ) picked[picked.length - 1] = codeQ;
  }
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked.map(q => String(q.id));
}

export async function seedDatabase() {
  await db.init();
  // Serverless instances cold-start frequently. Seeding is idempotent, but
  // re-checking ~300 rows on every start is wasteful and can exceed a function
  // timeout, so mark completion once and short-circuit afterwards.
  if (await db.one('settings', { key: 'seed_complete' })) return;
  const stamp = now();

  // ── Accounts. No public registration exists anywhere in the app. ──
  const accounts = [
    { accountId: env.studentAccount, name: env.studentName, role: 'student', password: env.studentPassword },
    { accountId: env.instructorAccount, name: env.instructorName, role: 'instructor', password: env.instructorPassword },
  ];
  for (const acc of accounts) {
    const existing = await db.one('profiles', { account_id: acc.accountId });
    if (existing) continue;
    await db.insert('profiles', {
      id: randomId(), account_id: acc.accountId, display_name: acc.name, role: acc.role,
      password_hash: await hashPassword(acc.password), created_at: stamp, last_active_at: null,
      auth_user_id: null,
    });
    console.log(`[seed] created ${acc.role} account ${acc.accountId}`);
  }

  // ── Curriculum. Existing rows (including instructor edits) are never overwritten. ──
  for (const s of SESSIONS) {
    if (!await db.one('sessions', { id: s.id })) {
      await db.insert('sessions', {
        id: s.id, order_index: s.orderIndex, slug: s.id, title: s.title, subtitle: s.subtitle,
        description: s.description, minutes: s.minutes, project_json: s.project,
        published: 1, created_at: stamp, updated_at: stamp,
      });
    }
    for (const [i, def] of s.lessons.entries()) {
      const id = lessonIdFor(s.id, def.slug);
      if (await db.one('lessons', { id })) continue;
      await db.insert('lessons', {
        id, session_id: s.id, slug: def.slug, order_index: i, title: def.title,
        minutes: def.minutes, content_json: buildLesson(def), topics_json: def.topics,
        published: 1, updated_at: stamp,
      });
    }
    const examId = examIdFor(s.id);
    const cfg = EXAM_CONFIGS.find(c => c.examId === examId)!;
    if (!await db.one('exams', { id: examId })) {
      await db.insert('exams', {
        id: examId, session_id: s.id, title: s.exam.title, brief: s.exam.brief,
        minutes: cfg.minutes, pass_mark: cfg.passMark, practical_pass: cfg.practicalPass,
        question_count: cfg.questionCount, requires_code: cfg.requiresCode ? 1 : 0,
        manual_review: s.id === 's13' ? 1 : 0, published: 1, updated_at: stamp,
      });
    }
  }

  // ── Question bank. Instructor edits / approvals are preserved. ──
  for (const q of QUESTION_BANK) {
    if (await db.one('question_bank', { id: q.id })) continue;
    await db.insert('question_bank', {
      id: q.id, exam_id: q.examId, objective: q.objective, type: q.type,
      difficulty: q.difficulty, points: q.points, prompt: q.prompt,
      variants_json: q.variants, options_json: q.options ?? null,
      correct_index: q.correctIndex ?? null, rubric_json: q.rubric ?? null,
      explanation: q.explanation, approved: q.approved ? 1 : 0, published: q.published ? 1 : 0,
      language: q.language ?? null, starter_code: q.starterCode ?? null,
      task_instructions: q.taskInstructions ?? null, context_code: q.contextCode ?? null,
      visible_tests_json: q.visibleTests ?? null, hidden_tests_json: q.hiddenTests ?? null,
      static_checks_json: q.staticChecks ?? null, updated_at: stamp,
    });
  }

  // ── Three genuinely different variants per exam. ──
  for (const s of SESSIONS) {
    const examId = examIdFor(s.id);
    const exam = await db.one('exams', { id: examId });
    if (!exam) continue;
    const questions = await db.all('question_bank', { where: { exam_id: examId, approved: 1, published: 1 } });
    for (let v = 0; v < 3; v++) {
      if (await db.one('exam_variants', { exam_id: examId, variant_index: v })) continue;
      await db.insert('exam_variants', {
        id: randomId(), exam_id: examId, label: `Variant ${String.fromCharCode(65 + v)}`,
        variant_index: v, seed: hashSeed(`${examId}:${v}`),
        question_ids_json: variantQuestionIds(questions, v, exam.question_count, !!exam.requires_code),
      });
    }
    if (!await db.one('settings', { key: `cursor:${examId}` })) {
      await db.insert('settings', { key: `cursor:${examId}`, value: '0' });
    }
  }

  // ── Verified YouTube resources. Real oEmbed data, no invented durations,
  //    no invented captions. Attached to individual lessons, not dumped as one. ──
  const checkedAt = stamp;
  for (const [i, v] of SEED_VIDEOS.entries()) {
    const existing = await db.all('video_resources', { where: { video_id: v.videoId } });
    if (existing.length) continue;
    for (const slug of v.lessonSlugs) {
      const sessionId = slug.slice(0, slug.indexOf('-l'));
      const lessonId = lessonIdFor(sessionId, slug);
      if (!await db.one('lessons', { id: lessonId })) continue;
      await db.insert('video_resources', {
        id: randomId(), lesson_id: lessonId, session_id: sessionId, youtube_url: v.url,
        video_id: v.videoId, playlist_id: null, is_playlist: 0,
        title: v.title, channel: v.channel, thumbnail_url: v.thumbnailUrl,
        duration_seconds: null, metadata_status: 'verified', metadata_checked_at: checkedAt,
        note: v.note, order_index: i, created_by: null, created_at: stamp,
      });
    }
  }

  await db.insert('settings', { key: 'seed_complete', value: stamp });
  console.log(`[seed] ready — ${SESSIONS.length} sessions, ${SESSIONS.reduce((n, s) => n + s.lessons.length, 0)} lessons, ${QUESTION_BANK.length} questions, ${SEED_VIDEOS.length} verified video sources`);
}
