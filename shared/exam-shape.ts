import type { CodeSnippet, QuestionType } from './types';

export interface TestCase {
  name: string;
  functionName: string;
  args?: unknown[];
  expected?: unknown;
  /** Optional raw JSON templates, so a variant can change inputs AND the
   *  corresponding expected value without breaking the hidden test. */
  argsTemplate?: string;
  expectedTemplate?: string;
}
export interface StaticCheck { name: string; pattern: string; description: string; mustMatch: boolean; flags?: string }

/** A question in the instructor-managed bank.
 *  {{placeholders}} in prompt/options/explanation/tasks are substituted with
 *  the chosen variant's data, so variants test the same objective with
 *  different scenarios, numbers, code and wording. */
export interface BankQuestion {
  id: string;
  examId: string;
  objective: string;
  type: QuestionType;
  difficulty: 'core' | 'applied' | 'hard';
  points: number;
  prompt: string;
  variants: Record<string, string | number>[];
  options?: string[];
  correctIndex?: number;
  rubric?: string[];
  explanation: string;
  approved: boolean;
  published: boolean;
  /* coding tasks */
  language?: CodeSnippet['language'];
  starterCode?: string;
  taskInstructions?: string;
  contextCode?: string;
  visibleTests?: TestCase[];
  hiddenTests?: TestCase[];
  staticChecks?: StaticCheck[];
}

export interface ExamConfig {
  examId: string;
  questionCount: number;
  passMark: number;
  practicalPass: number;
  minutes: number;
  requiresCode: boolean;
}

export const placeholder = (text: string, data: Record<string, string | number>): string =>
  text.replace(/\{\{(\w+)\}\}/g, (_m, key) => String(data[key] ?? `{{${key}}}`));
