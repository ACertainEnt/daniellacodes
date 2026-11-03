import { EXAMS_A, CONFIG_A } from './exams-a';
import { EXAMS_B, CONFIG_B } from './exams-b';
import type { BankQuestion, ExamConfig } from './exam-shape';

export const QUESTION_BANK: BankQuestion[] = [...EXAMS_A, ...EXAMS_B];
export const EXAM_CONFIGS: ExamConfig[] = [...CONFIG_A, ...CONFIG_B];
export const examConfig = (examId: string): ExamConfig => {
  const c = EXAM_CONFIGS.find(x => x.examId === examId);
  if (!c) throw new Error(`No exam config for ${examId}`);
  return c;
};
export const bankForExam = (examId: string): BankQuestion[] => QUESTION_BANK.filter(q => q.examId === examId && q.approved && q.published);
export type { BankQuestion, ExamConfig, TestCase, StaticCheck } from './exam-shape';
