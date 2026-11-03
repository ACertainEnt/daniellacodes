import { placeholder } from '../shared/exam-shape';
import type { BankQuestion, TestCase, StaticCheck } from '../shared/exams';
import type { ExamQuestionPublic, QuestionGrade, QuestionType } from '../shared/types';
import { db } from './db';
import { now, randomId } from './env';
import { runJavaScript, type TestOutcome } from './sandbox';

export interface Snapshot {
  id: string;
  type: QuestionType;
  objective: string;
  difficulty: 'core' | 'applied' | 'hard';
  points: number;
  prompt: string;
  options: string[];
  correctIndex: number;
  correctText: string | null;
  rubric: string[];
  explanation: string;
  language?: string;
  starterCode?: string;
  taskInstructions?: string;
  visibleTests: TestCase[];
  hiddenTests: TestCase[];
  staticChecks: Array<StaticCheck & { pattern: string }>;
  variantLabel: string;
}

const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

const substitute = (text: string | undefined, data: Record<string, string | number>) =>
  text ? placeholder(text, data) : '';

/** Render a bank question for one variant. Correct answers stay in the
 *  server-side snapshot and are NEVER part of the student-facing sheet. */
export function renderQuestion(row: Record<string, any>, variantIndex: number, attemptSeed: number, variantLabel: string): Snapshot {
  const variants: Record<string, string | number>[] = row.variants_json || [{}];
  const data = variants[variantIndex % variants.length] || variants[0] || {};
  const random = mulberry32(attemptSeed + String(row.id).split('').reduce((n: number, c: string) => n + c.charCodeAt(0), 0));

  const rawOptions: string[] = (row.options_json || []).map((o: string) => substitute(o, data));
  const correctIndex = Number(row.correct_index ?? 0);
  const correctText = rawOptions[correctIndex] ?? null;
  const decorated = rawOptions.map((text, i) => ({ text, i }));
  for (let i = decorated.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [decorated[i], decorated[j]] = [decorated[j], decorated[i]];
  }
  const options = decorated.map(d => d.text);

  const staticChecks = ((row.static_checks_json || []) as StaticCheck[]).map(ch => ({
    ...ch, pattern: substitute(ch.pattern, data),
  }));
  const renderTest = (t: TestCase): TestCase => ({
    ...t,
    args: t.argsTemplate ? JSON.parse(substitute(t.argsTemplate, data)) : t.args,
    expected: t.expectedTemplate ? JSON.parse(substitute(t.expectedTemplate, data)) : t.expected,
  });

  return {
    id: row.id, type: row.type as QuestionType, objective: row.objective,
    difficulty: row.difficulty, points: Number(row.points),
    prompt: substitute(row.prompt, data), options,
    correctIndex: options.findIndex(o => o === correctText), correctText,
    rubric: (row.rubric_json || []).map((r: string) => substitute(r, data)),
    explanation: substitute(row.explanation, data),
    language: row.language ?? undefined,
    starterCode: substitute(row.starter_code, data) || undefined,
    taskInstructions: substitute(row.task_instructions, data) || undefined,
    visibleTests: (row.visible_tests_json || []).map(renderTest),
    hiddenTests: (row.hidden_tests_json || []).map(renderTest),
    staticChecks, variantLabel,
  };
}

export const publicQuestion = (s: Snapshot): ExamQuestionPublic => ({
  id: s.id, type: s.type, prompt: s.prompt, options: s.options, points: s.points,
  difficulty: s.difficulty, objective: s.objective, requiresCode: s.type === 'coding',
  language: s.language as ExamQuestionPublic['language'],
  starterCode: s.starterCode, taskInstructions: s.taskInstructions,
  visibleTests: s.visibleTests.map(t => ({ name: t.name, input: t.args ?? [], expected: t.expected })),
  maxChars: s.type === 'short' ? 1200 : undefined,
});

function gradeShort(answer: string, rubric: string[], points: number): { awarded: number; feedback: string } {
  const text = (answer || '').toLowerCase();
  if (!rubric.length) return { awarded: 0, feedback: 'No grading rubric was configured for this question.' };
  const hits = rubric.filter(k => text.includes(k.toLowerCase())).length;
  const ratio = hits / rubric.length;
  const awarded = Math.round(points * Math.min(1, ratio / 0.7) * 100) / 100;
  return { awarded, feedback: `Your answer covered ${hits} of ${rubric.length} required concepts.` };
}

export interface CodeGradeDetail {
  staticResults: { name: string; description: string; passed: boolean }[];
  testResults: TestOutcome[];
  logs: string[];
  error?: string;
}

async function gradeCoding(s: Snapshot, code: string, attemptId: string, profileId: string): Promise<{ awarded: number; feedback: string; detail: CodeGradeDetail }> {
  const staticResults = s.staticChecks.map(ch => {
    let matched = false;
    try { matched = new RegExp(ch.pattern, ch.flags || '').test(code); }
    catch { matched = false; }
    return { name: ch.name, description: ch.description, passed: ch.mustMatch ? matched : !matched };
  });
  const staticPass = staticResults.filter(r => r.passed).length;

  let testResults: TestOutcome[] = [];
  let logs: string[] = [];
  let runError: string | undefined;
  if (s.hiddenTests.length) {
    const run = await runJavaScript(code, s.hiddenTests);
    testResults = run.results; logs = run.logs; runError = run.error;
  }
  const hiddenPass = testResults.filter(r => r.passed).length;

  let fraction = 0;
  if (s.staticChecks.length && s.hiddenTests.length) {
    fraction = 0.4 * (staticPass / s.staticChecks.length) + 0.6 * (hiddenPass / Math.max(1, s.hiddenTests.length));
  } else if (s.staticChecks.length) {
    fraction = staticPass / s.staticChecks.length;
  } else if (s.hiddenTests.length) {
    fraction = hiddenPass / Math.max(1, s.hiddenTests.length);
  }
  const awarded = Math.round(s.points * fraction * 100) / 100;

  // Persist the submission and every hidden-test result for instructor review.
  const submissionId = randomId();
  await db.insert('submissions', {
    id: submissionId, attempt_id: attemptId, question_id: s.id, profile_id: profileId,
    code, language: s.language || 'javascript',
    output_json: { logs, error: runError ?? null, staticResults }, created_at: now(),
  });
  for (const r of testResults) {
    await db.insert('coding_test_results', {
      id: randomId(), submission_id: submissionId, attempt_id: attemptId, question_id: s.id,
      test_name: r.name, passed: r.passed ? 1 : 0,
      message: r.error || `got ${r.actual ?? '—'}, expected ${r.expected ?? '—'}`,
      hidden: 1, created_at: now(),
    });
  }
  const feedback = `Structural checks: ${staticPass}/${s.staticChecks.length}. Hidden tests: ${hiddenPass}/${s.hiddenTests.length}.${runError ? ' Runner: ' + runError : ''}`;
  return { awarded, feedback, detail: { staticResults, testResults, logs, error: runError } };
}

export interface GradeOutcome {
  grades: QuestionGrade[];
  totalAwarded: number;
  totalAvailable: number;
  score: number;
  practicalScore: number | null;
  codeDetails: Record<string, CodeGradeDetail>;
}

/** Grade from the immutable server-side snapshot, never from client data. */
export async function gradeAttempt(
  attempt: Record<string, any>, answers: Record<string, string>, snapshot: Snapshot[],
): Promise<GradeOutcome> {
  const grades: QuestionGrade[] = [];
  const codeDetails: Record<string, CodeGradeDetail> = {};
  let awarded = 0, available = 0, practicalAwarded = 0, practicalAvailable = 0;

  for (const q of snapshot) {
    available += q.points;
    const answer = answers[q.id] ?? '';
    let got = 0;
    let feedback = '';
    let correctAnswer: string | undefined;

    if (q.type === 'coding') {
      practicalAvailable += q.points;
      const result = await gradeCoding(q, answer, attempt.id, attempt.profile_id);
      got = result.awarded; feedback = result.feedback;
      codeDetails[q.id] = result.detail;
      practicalAwarded += got;
    } else if (q.type === 'short') {
      const g = gradeShort(answer, q.rubric, q.points);
      got = g.awarded; feedback = g.feedback;
      correctAnswer = `Expected concepts: ${q.rubric.join(', ')}`;
    } else {
      got = answer && answer === q.correctText ? q.points : 0;
      feedback = got ? 'Correct.' : 'Not quite — review the explanation after submission.';
      correctAnswer = q.correctText ?? undefined;
    }
    awarded += got;
    grades.push({
      questionId: q.id, awarded: got, available: q.points, correct: got >= q.points * 0.999,
      feedback, correctAnswer, explanation: q.explanation,
    });
  }
  return {
    grades, totalAwarded: Math.round(awarded * 100) / 100, totalAvailable: available,
    score: available ? Math.round((awarded / available) * 1000) / 10 : 0,
    practicalScore: practicalAvailable ? Math.round((practicalAwarded / practicalAvailable) * 1000) / 10 : null,
    codeDetails,
  };
}
