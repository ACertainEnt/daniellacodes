/* Structural validation of the authored curriculum and question bank.
   Run: npx tsx scripts/verify-curriculum.ts */
import { TOPICS } from '../shared/topics';
import { SESSIONS, buildLesson, lessonIdFor, examIdFor } from '../shared/curriculum';
import { QUESTION_BANK, EXAM_CONFIGS } from '../shared/exams';
import { SEED_VIDEOS } from '../shared/videos';

let errors = 0;
const fail = (msg: string) => { console.log('  FAIL  ' + msg); errors++; };
const ok = (msg: string) => console.log('  PASS  ' + msg);
const placeholders = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]);

console.log('── Curriculum structure ───────────────────────────────────');
if (SESSIONS.length === 14 && SESSIONS.every((s, i) => s.orderIndex === i && s.id === `s${i}`)) ok('14 sessions in the exact specified order');
else fail('session count or order is wrong');

const lessonCount = SESSIONS.reduce((n, s) => n + s.lessons.length, 0);
if (SESSIONS.every(s => s.lessons.length >= 2)) ok(`${lessonCount} lessons, every session has multiple lessons`);
else fail('a session has fewer than 2 lessons');

const usedTopics = new Set<string>();
let contentIssues = 0;
for (const s of SESSIONS) {
  for (const l of s.lessons) {
    for (const key of l.topics) {
      usedTopics.add(key);
      if (!TOPICS[key]) { fail(`unknown topic "${key}" in ${s.id}/${l.slug}`); contentIssues++; }
    }
    const body = buildLesson(l);
    // Sections 7/8 are "code snippets / line-by-line where applicable": a
    // concept lesson legitimately has no code, but the slots must exist.
    const required = [body.title, body.whatYouWillLearn, body.whyItMatters, body.explanation, body.stepByStep,
      body.examples, body.commonMistakes, body.practicalExercise, body.knowledgeCheck, body.recap];
    if (required.some(p => !p || (Array.isArray(p) && !p.length))) { fail(`incomplete 13-part structure: ${s.id}/${l.slug}`); contentIssues++; }
    if (!Array.isArray(body.codeSnippets) || !Array.isArray(body.lineByLine)) { fail(`missing code-snippet slots: ${s.id}/${l.slug}`); contentIssues++; }
    if (body.knowledgeCheck.some(q => q.options[q.answerIndex] === undefined)) { fail(`bad knowledge-check answer index: ${s.id}/${l.slug}`); contentIssues++; }
  }
  if (!s.project.brief || !s.project.acceptanceCriteria.length) fail(`missing project brief: ${s.id}`);
  if (!s.exam.brief) fail(`missing exam brief: ${s.id}`);
}
if (!contentIssues) ok('every lesson expands into the full 13-section teaching format');
const unused = Object.keys(TOPICS).filter(k => !usedTopics.has(k));
if (!unused.length) ok(`all ${Object.keys(TOPICS).length} plain-English topic explanations are used`);
else console.log(`  NOTE  ${unused.length} authored topics are not attached to a lesson: ${unused.join(', ')}`);

console.log('\n── Question bank ──────────────────────────────────────────');
const ids = new Set<string>();
let bankIssues = 0;
for (const examId of SESSIONS.map(s => examIdFor(s.id))) {
  const bank = QUESTION_BANK.filter(q => q.examId === examId && q.approved && q.published);
  if (bank.length >= 10) ok(`${examId}: ${bank.length} live questions (≥10)`);
  else { fail(`${examId}: only ${bank.length} live questions`); bankIssues++; }
  if (EXAM_CONFIGS.some(c => c.examId === examId)) ok(`${examId}: exam config present`);
  else { fail(`${examId}: no exam config`); bankIssues++; }
}
for (const q of QUESTION_BANK) {
  if (ids.has(q.id)) { fail(`duplicate question id ${q.id}`); bankIssues++; }
  ids.add(q.id);
  const variantKeys = new Set(q.variants.flatMap(v => Object.keys(v)));
  const texts = [q.prompt, ...(q.options || []), q.explanation, q.taskInstructions || '', q.starterCode || '',
    ...(q.staticChecks || []).map(c => c.pattern)];
  for (const t of texts) {
    for (const key of placeholders(t)) {
      if (!variantKeys.has(key)) { fail(`${q.id}: placeholder {{${key}}} has no variant data`); bankIssues++; }
    }
  }
  for (const ch of q.staticChecks || []) {
    try { new RegExp(ch.pattern.replace(/\{\{\w+\}\}/g, 'x'), ch.flags || ''); }
    catch (e: any) { fail(`${q.id}: invalid static-check regex (${e.message})`); bankIssues++; }
  }
  for (const t of [...(q.visibleTests || []), ...(q.hiddenTests || [])]) {
    for (const raw of [t.argsTemplate, t.expectedTemplate]) {
      if (!raw) continue;
      try { JSON.parse(raw.replace(/\{\{\w+\}\}/g, '1')); }
      catch (e: any) { fail(`${q.id}: test template is not valid JSON (${e.message})`); bankIssues++; }
    }
  }
}
if (!bankIssues) ok(`${QUESTION_BANK.length} questions: unique ids, resolvable placeholders, valid regexes and test templates`);

console.log('\n── Video resources ────────────────────────────────────────');
let videoIssues = 0;
const knownLessons = new Set(SESSIONS.flatMap(s => s.lessons.map(l => lessonIdFor(s.id, l.slug))));
for (const v of SEED_VIDEOS) {
  if (!/^[A-Za-z0-9_-]{11}$/.test(v.videoId)) { fail(`invalid video id ${v.videoId}`); videoIssues++; }
  if (!v.title || !v.channel || !v.thumbnailUrl) { fail(`missing verified metadata for ${v.key}`); videoIssues++; }
  if ('durationSeconds' in v) { fail(`${v.key} invents a duration`); videoIssues++; }
  for (const slug of v.lessonSlugs) {
    const sid = slug.slice(0, slug.indexOf('-l'));
    if (!knownLessons.has(lessonIdFor(sid, slug))) { fail(`${v.key} references unknown lesson ${slug}`); videoIssues++; }
  }
}
if (!videoIssues) ok(`${SEED_VIDEOS.length} verified video sources, no invented titles/durations/captions, split across individual lessons`);

console.log(`\n════════ ${errors === 0 ? 'CURRICULUM VALID' : errors + ' ERROR(S)'} ════════`);
process.exit(errors ? 1 : 0);
