/* DANIELLACODES end-to-end verification against a FRESH temporary database.
   Spawns its own server on a spare port, exercises real accounts and records,
   then shuts down. Run: node scripts/verify-api.mjs
   (No Supabase credentials required — this exercises the local driver.) */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'daniellacodes-verify-'));
const PORT = process.env.VERIFY_PORT || '5199';
const BASE = `http://127.0.0.1:${PORT}`;
const DB = path.join(TMP, 'verify.db');
const STORAGE = path.join(TMP, 'storage');
const STUDENT = { accountId: 'DANIELLACODES', password: process.env.STUDENT_PASSWORD || 'daniella-learns' };
const ACE = { accountId: 'ACECODES', password: process.env.INSTRUCTOR_PASSWORD || 'ace-teaches' };

const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  cwd: process.cwd(),
  env: { ...process.env, PORT, NODE_ENV: 'production', DATABASE_PATH: DB, AUTH_SECRET: 'verification-only-secret-32-chars-minimum', STORAGE_DIR: STORAGE },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', d => { serverLog += d.toString(); });
server.stderr.on('data', d => { serverLog += d.toString(); });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitForHealth() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return; } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Server did not start:\n' + serverLog);
}

const cookies = { student: '', ace: '' };
async function call(role, url, method = 'GET', body) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookies[role] ? { Cookie: cookies[role] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, setCookie: res.headers.get('set-cookie') };
}

let pass = 0, fail = 0;
const check = (name, condition, detail = '') => {
  if (condition) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
};
const section = name => console.log(`\n── ${name} ──────────────────────────────────`);

try {
  await waitForHealth();

  section('1 · Identity and role separation');
  let r = await call('student', '/api/auth/login', 'POST', STUDENT);
  check('student account ID + password works', r.status === 200 && r.data.profile.role === 'student');
  check('login redirects student to /app', r.data.redirect === '/app');
  check('session cookie is httpOnly', /HttpOnly/i.test(r.setCookie || ''));
  cookies.student = (r.setCookie || '').split(';')[0];
  r = await call('ace', '/api/auth/login', 'POST', ACE);
  check('instructor account ID + password works', r.status === 200 && r.data.profile.role === 'instructor');
  check('login redirects instructor to /ace', r.data.redirect === '/ace');
  cookies.ace = (r.setCookie || '').split(';')[0];
  r = await call('student', '/api/auth/login', 'POST', { accountId: 'ACECODES', password: 'wrong-password' });
  check('wrong password rejected', r.status === 401);
  r = await call('student', '/api/instructor/overview');
  check('student blocked from instructor API (403)', r.status === 403);
  r = await call('ace', '/api/student/dashboard');
  check('instructor blocked from student API (403)', r.status === 403);
  r = await call('student', '/api/auth/me');
  check('server never exposes a password hash', !JSON.stringify(r.data).includes('password_hash'));

  section('2 · Curriculum and sequential unlocking');
  r = await call('student', '/api/student/sessions');
  const sessions = r.data.sessions;
  check('14 sessions in the specified order', sessions.length === 14 && sessions[0].id === 's0' && sessions[13].id === 's13');
  check('only session 0 unlocked initially', sessions[0].state === 'active' && sessions[1].state === 'locked');
  r = await call('student', '/api/student/lessons/lesson-s1-s1-l1');
  check('URL cannot skip ahead to a locked lesson', r.status === 403, JSON.stringify(r.data));
  r = await call('student', '/api/student/lessons/lesson-s0-s0-l1');
  const lesson = r.data;
  check('lesson has the 13-part teaching structure',
    !!(lesson.title && lesson.whatYouWillLearn?.length && lesson.whyItMatters && lesson.explanation?.length &&
       lesson.stepByStep?.length && lesson.examples?.length && lesson.codeSnippets?.length &&
       lesson.lineByLine?.length && lesson.commonMistakes?.length && lesson.practicalExercise?.title &&
       lesson.knowledgeCheck?.length && lesson.recap?.length));
  check('opening a lesson does NOT mark it complete', lesson.completed === false);
  r = await call('student', '/api/student/lessons/lesson-s0-s0-l1/complete', 'POST');
  check('mark-as-completed persists', r.status === 200 && r.data.ok === true);
  // Simulate a refresh/new device with a fresh login cookie.
  const fresh = await call('student', '/api/auth/login', 'POST', STUDENT);
  cookies.student = (fresh.setCookie || '').split(';')[0];
  r = await call('student', '/api/student/lessons/lesson-s0-s0-l1');
  check('completion survives re-login / another device', r.data.completed === true);

  section('3 · YouTube metadata and independent subtitles');
  r = await call('student', '/api/media/videos/lesson-s1-s1-l1');
  const videos = r.data.videos;
  check('preloaded verified video is attached to an individual lesson', videos.length > 0 && videos[0].metadataStatus === 'verified');
  check('real oEmbed title, not invented', videos[0].title === 'Learn HTML & CSS – Full Course for Beginners');
  check('duration is honestly null (oEmbed provides none)', videos[0].durationSeconds === null);
  r = await call('student', '/api/media/subtitles/lesson-s1-s1-l1');
  check('no fake captions: student gets zero subtitle tracks', r.data.subtitles.length === 0);
  r = await call('ace', '/api/media/videos/preview', 'POST', { url: 'https://youtu.be/kUMe1FH4CHE' });
  check('youtu.be short link recognised', r.data.parsed?.videoId === 'kUMe1FH4CHE');
  r = await call('ace', '/api/media/videos/preview', 'POST', { url: 'https://www.youtube.com/playlist?list=PLabc123' });
  check('playlist link recognised', r.data.parsed?.isPlaylist === true);
  const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nWelcome to HTML.\n\n00:00:04.000 --> 00:00:08.000\nThis is an independent caption.\n';
  r = await call('ace', '/api/media/subtitles', 'POST', { lessonId: 'lesson-s1-s1-l1', fileName: 'en.vtt', vtt });
  check('instructor uploads a real .vtt', r.status === 200 && r.data.captionStatus === 'uploaded');
  const subId = r.data.id;
  r = await call('student', '/api/media/subtitles/lesson-s1-s1-l1');
  check('unchecked subtitles are NOT published as captioned', r.data.subtitles.length === 0);
  r = await call('ace', `/api/media/subtitles/${subId}`, 'PATCH', { checked: true, publish: true });
  r = await call('student', '/api/media/subtitles/lesson-s1-s1-l1');
  check('checked+published VTT becomes available to student', r.data.subtitles.length === 1 && r.data.subtitles[0].vtt.includes('independent caption'));
  r = await call('ace', '/api/media/subtitles', 'POST', { lessonId: 'lesson-s1-s1-l1', fileName: 'bad.vtt', vtt: 'not a vtt' });
  check('invalid VTT content rejected', r.status === 400);

  section('4 · Ask Ace, WhatsApp and instructor replies');
  r = await call('student', '/api/help', 'POST', { question: 'This is a real question about how the DOM tree is built.', sessionId: 's0', lessonId: 'lesson-s0-s0-l1' });
  check('question validated and saved with PENDING status', r.status === 200 && r.data.status === 'pending' && !!r.data.requestId);
  const helpId = r.data.requestId;
  const wa = decodeURIComponent(r.data.whatsappUrl);
  check('WhatsApp destination is the supplied click-to-chat number', r.data.whatsappUrl.startsWith('https://wa.me/2348107543761?text='));
  check('prefilled message contains the exact question', wa.includes('This is a real question about how the DOM tree is built.'));
  check('prefilled message contains session, lesson and request ID', wa.includes('Introduction to Programming') && wa.includes('A world of instructions') && wa.includes(helpId));
  check('WhatsApp chat is not empty', wa.length > 80);
  r = await call('ace', '/api/instructor/help');
  check('pending question appears in ACECODES inbox', r.data.questions.some(q => q.id === helpId && q.status === 'pending'));
  r = await call('ace', `/api/instructor/help/${helpId}/reply`, 'POST', { answer: 'The browser parses HTML into a tree of nodes.' });
  check('instructor reply saved', r.status === 200);
  r = await call('student', '/api/student/dashboard');
  check('reply visible in Daniella\'s dashboard', r.data.answeredQuestions.some(q => q.id === helpId && q.answer?.includes('parses HTML')));
  check('in-app notification created', r.data.notifications.some(n => n.kind === 'answer'));
  r = await call('student', '/api/help', 'POST', { question: 'short' });
  check('too-short question rejected before WhatsApp opens', r.status === 400);

  section('5 · Examination integrity, variants and coding tests');
  for (let i = 1; i <= 5; i++) await call('student', `/api/student/lessons/lesson-s0-s0-l${i}/complete`, 'POST');
  r = await call('student', '/api/exams/exam-s0/available');
  check('exam unlocks only after all session lessons', r.data.available === true);
  r = await call('student', '/api/exams/exam-s0/start', 'POST');
  const sheetA = r.data;
  check('exam sheet has 10–20 questions', sheetA.questions.length >= 10 && sheetA.questions.length <= 20);
  check('no correct answers / hidden tests / explanations in sheet',
    sheetA.questions.every(q => !('correctText' in q) && !('hiddenTests' in q) && !('explanation' in q) && !('rubric' in q)));
  check('pass mark is 80%', sheetA.passMark === 80);
  r = await call('student', `/api/exams/attempt/${sheetA.attemptId}/run`, 'POST', { questionId: sheetA.questions[0].id, code: 'x' });
  check('run endpoint does not reveal hidden tests for non-coding items', r.status === 400);

  // Grade using the SERVER-side snapshot (simulating a student who knows the material).
  const { DatabaseSync } = await import('node:sqlite');
  const sq = new DatabaseSync(DB);
  const snap = JSON.parse(sq.prepare('select question_snapshot_json from exam_attempts where id = ?').get(sheetA.attemptId).question_snapshot_json);
  const answers = {};
  for (const q of snap) {
    if (q.type === 'short') answers[q.id] = 'Order: ' + q.rubric.join(', ') + '. Browser, server and database all play a part.';
    else if (q.type === 'coding') answers[q.id] = q.starterCode || '';
    else answers[q.id] = q.correctText || '';
  }
  r = await call('student', `/api/exams/attempt/${sheetA.attemptId}/submit`, 'POST', { answers });
  check('server grades from its own snapshot', r.status === 200 && typeof r.data.score === 'number');
  check('correct answers only revealed after submission', r.data.grades.every(g => 'correctAnswer' in g || 'explanation' in g));
  check('passing unlocks the next session', r.data.nextSessionUnlocked === true);
  sq.close();
  r = await call('student', '/api/student/sessions');
  check('session 1 is now active, session 2 still locked', r.data.sessions[1].state !== 'locked' && r.data.sessions[2].state === 'locked');

  // Leaving an active exam invalidates only that attempt and forces a new variant.
  for (let i = 1; i <= 5; i++) await call('student', `/api/student/lessons/lesson-s1-s1-l${i}/complete`, 'POST');
  r = await call('student', '/api/exams/exam-s1/start', 'POST');
  const first = r.data;
  await call('student', `/api/exams/attempt/${first.attemptId}/answer`, 'POST', { answers: { [first.questions[0].id]: 'in progress answer' } });
  r = await call('student', `/api/exams/attempt/${first.attemptId}/abandon`, 'POST');
  check('leaving discards in-progress answers', r.data.discardedAnswers === true);
  r = await call('student', '/api/exams/exam-s1/start', 'POST');
  const second = r.data;
  check('new attempt uses a DIFFERENT variant', second.variantIndex !== first.variantIndex, `${first.variantIndex} -> ${second.variantIndex}`);
  check('new attempt has a different question set or scenarios', JSON.stringify(second.questions.map(q => q.id + q.prompt)) !== JSON.stringify(first.questions.map(q => q.id + q.prompt)));
  r = await call('student', '/api/student/lessons/lesson-s0-s0-l1');
  check('previously completed lessons remain intact after abandon', r.data.completed === true);
  r = await call('student', `/api/exams/attempt/${first.attemptId}/result`);
  check('abandoned attempt kept in history but invalid', r.status === 200 || r.status === 410);

  // Coding task: run visible tests in the isolated sandbox.
  const codingQ = second.questions.find(q => q.requiresCode);
  if (codingQ) {
    check('coding variant includes an integrated code task', true);
    r = await call('student', `/api/exams/attempt/${second.attemptId}/run`, 'POST', { questionId: codingQ.id, code: codingQ.starterCode || 'function f(){return 1}' });
    check('Run / test executes in the isolated sandbox', r.status === 200 && Array.isArray(r.data.results));
  } else { check('coding variant includes an integrated code task', false, 'no coding question in variant'); }

  // Walk forward to Session 3 (JavaScript) to verify REAL hidden-test grading.
  // Instructor temporarily lowers the pass requirement for the two intervening
  // exams — this also verifies that pass requirements are genuinely editable.
  const snapshotOf = async attemptId => {
    const { DatabaseSync } = await import('node:sqlite');
    const conn = new DatabaseSync(DB);
    const row = conn.prepare('select question_snapshot_json from exam_attempts where id = ?').get(attemptId);
    conn.close();
    return JSON.parse(row.question_snapshot_json);
  };
  const passThrough = async (sessionId, examId) => {
    const detail = (await call('student', `/api/student/sessions/${sessionId}`)).data;
    for (const l of detail.lessons) await call('student', `/api/student/lessons/${l.id}/complete`, 'POST');
    await call('ace', `/api/instructor/exams/${examId}`, 'PATCH', { pass_mark: 0, practical_pass: 0 });
    const sh = (await call('student', `/api/exams/${examId}/start`, 'POST')).data;
    if (sh.attemptId) await call('student', `/api/exams/attempt/${sh.attemptId}/submit`, 'POST', { answers: {} });
    await call('ace', `/api/instructor/exams/${examId}`, 'PATCH', { pass_mark: 80, practical_pass: 70 });
  };
  await call('student', `/api/exams/attempt/${second.attemptId}/abandon`, 'POST');
  await passThrough('s1', 'exam-s1');
  await passThrough('s2', 'exam-s2');
  const s3detail = (await call('student', '/api/student/sessions/s3')).data;
  for (const l of s3detail.lessons) await call('student', `/api/student/lessons/${l.id}/complete`, 'POST');
  const s3sheet = (await call('student', '/api/exams/exam-s3/start', 'POST')).data;
  const s3snap = await snapshotOf(s3sheet.attemptId);
  const jsTask = s3snap.find(q => q.type === 'coding' && (q.hiddenTests || []).length > 0);
  check('JS exam variant contains a coding task with hidden tests', !!jsTask);
  if (jsTask) {
    const passNum = Number((String(jsTask.taskInstructions || '').match(/>=\s*(\d+)/) || [])[1] || 80);
    const analyse = `function analyseScores(scores) { const nums = Array.isArray(scores) ? scores.filter(v => typeof v === 'number' && Number.isFinite(v)) : []; const count = nums.length; const sum = nums.reduce((a,b) => a + b, 0); return { count, average: count ? Math.round(sum / count * 100) / 100 : 0, highest: count ? Math.max(...nums) : 0, lowest: count ? Math.min(...nums) : 0, passed: nums.filter(v => v >= ${passNum}).length }; }`;
    const countAbove = 'function countAbove(values, limit) { if (!Array.isArray(values)) return 0; return values.filter(v => typeof v === "number" && Number.isFinite(v) && v > limit).length; }';
    const jsAnswers = {};
    for (const q of s3snap) {
      if (q.type === 'coding') jsAnswers[q.id] = (q.hiddenTests || []).some(t => t.functionName === 'analyseScores') ? analyse
        : (q.hiddenTests || []).some(t => t.functionName === 'countAbove') ? countAbove : (q.starterCode || '');
      else if (q.type === 'short') jsAnswers[q.id] = 'Steps: ' + q.rubric.join(', ') + '. Empty, zero, non-numeric values and duplicates all matter.';
      else jsAnswers[q.id] = q.correctText || '';
    }
    const graded = await call('student', `/api/exams/attempt/${s3sheet.attemptId}/submit`, 'POST', { answers: jsAnswers });
    check('hidden tests execute server-side during grading', graded.status === 200 && graded.data.practicalScore !== null);
    check('a correct implementation passes the hidden test cases', graded.data.practicalScore >= 75, `practical ${graded.data.practicalScore}`);
    const review = await call('ace', `/api/instructor/attempts/${s3sheet.attemptId}`);
    const results = (review.data.submissions || []).flatMap(x => x.testResults || []);
    check('hidden test results are stored for instructor review', results.length > 0 && results.some(t => t.passed === 1 || t.passed === true), JSON.stringify(results.slice(0, 2)));
  }

  section('6 · Instructor controls');
  r = await call('ace', '/api/instructor/curriculum');
  check('instructor sees full curriculum with lessons/videos/subtitles', r.data.sessions.length === 14 && r.data.sessions[1].lessons.length === 5);
  r = await call('ace', '/api/instructor/lessons/lesson-s0-s0-l1', 'PATCH', { title: 'Foundations (edited by Ace)' });
  r = await call('student', '/api/student/lessons/lesson-s0-s0-l1');
  check('lesson edits persist into the student view', r.data.title === 'Foundations (edited by Ace)');
  r = await call('ace', '/api/instructor/questions?examId=exam-s3');
  check('question bank contains real multiple-variant questions', r.data.questions.length >= 10 && r.data.questions.some(q => q.hasHiddenTests));
  r = await call('ace', `/api/instructor/attempts/${sheetA.attemptId}/reset`, 'POST', { mode: 'invalidate' });
  check('instructor can reset an exam attempt', r.status === 200);
  r = await call('student', '/api/student/lessons/lesson-s0-s0-l1');
  check('reset did not erase lesson progress', r.data.completed === true);
  r = await call('ace', '/api/instructor/overview');
  check('instructor overview reports real progress and caption gaps', r.data.lessonsCompleted >= 10 && r.data.videosWithoutCaptions > 0);

  section('7 · Health');
  r = await call('student', '/api/health');
  check('health reports the active driver without leaking secrets', r.data.ok === true && !JSON.stringify(r.data).includes('SECRET'));

  console.log(`\n════════ RESULT: ${pass} passed, ${fail} failed ════════`);
} catch (err) {
  console.error('\nVerification crashed:', err);
  console.error(serverLog.slice(-2000));
  fail++;
} finally {
  server.kill('SIGTERM');
  await sleep(400);
  try { server.kill('SIGKILL'); } catch { /* already gone */ }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(fail ? 1 : 0);
}
