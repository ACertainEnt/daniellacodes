/* Domain and API contracts shared by the browser and the server.
   Nothing in here is a secret: no hashes, hidden tests or correct answers
   are part of any type that is serialised to a student before grading. */

export type Role = 'student' | 'instructor';
export type AttemptStatus = 'active' | 'submitted' | 'graded' | 'abandoned' | 'awaiting_review';
export type QuestionStatus = 'pending' | 'answered';
export type QuestionType = 'mcq' | 'short' | 'code_reading' | 'debug' | 'scenario' | 'coding';
export type CaptionStatus = 'not_supplied' | 'uploaded' | 'checked' | 'published';

export interface PublicProfile {
  id: string;
  accountId: string;
  displayName: string;
  role: Role;
  createdAt: string;
}

export interface CodeSnippet {
  language: 'html' | 'css' | 'javascript' | 'jsx' | 'sql' | 'bash' | 'json' | 'text';
  title: string;
  code: string;
  lineNotes: { line: number; note: string }[];
}

export interface KnowledgeCheck {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

/* The mandatory 13-part lesson structure. Item 13 (mark as completed) is
   a real persisted action in the UI, not a text block. */
export interface LessonContent {
  title: string;                         // 1
  whatYouWillLearn: string[];            // 2
  whyItMatters: string;                  // 3
  explanation: { heading: string; paragraphs: string[] }[]; // 4
  stepByStep: { title: string; detail: string }[];          // 5
  examples: { title: string; detail: string }[];            // 6
  codeSnippets: CodeSnippet[];          // 7
  lineByLine: { snippet: string; notes: string[] }[];      // 8
  commonMistakes: string[];             // 9
  practicalExercise: { title: string; brief: string; steps: string[]; successChecks: string[] };
  knowledgeCheck: KnowledgeCheck[];     // 11
  recap: string[];                      // 12
}

export interface ProjectBrief {
  title: string;
  brief: string;
  requirements: string[];
  acceptanceCriteria: string[];
  stretchGoals: string[];
}

export interface LessonDefinition {
  slug: string;
  title: string;
  minutes: number;
  why: string;
  topics: string[];           // keys into shared/topics.ts
  exercise: { title: string; brief: string; steps: string[]; successChecks: string[] };
  recap: string[];
}

export interface SessionDefinition {
  id: string;                 // s0 … s13
  orderIndex: number;
  title: string;
  subtitle: string;
  description: string;
  minutes: number;
  lessons: LessonDefinition[];
  project: ProjectBrief;
  exam: { title: string; minutes: number; requiresCode: boolean; practicalPass: number; brief: string };
}

export interface Lesson extends LessonContent {
  id: string;
  sessionId: string;
  slug: string;
  orderIndex: number;
  minutes: number;
  published: boolean;
  topics: string[];
  updatedAt: string;
}

export interface SessionSummary {
  id: string;
  orderIndex: number;
  title: string;
  subtitle: string;
  description: string;
  state: 'completed' | 'active' | 'locked';
  lessonCount: number;
  lessonsCompleted: number;
  examPassed: boolean;
  examAttempts: number;
  bestScore: number | null;
  unlockReason: string;
}

export interface VideoResource {
  id: string;
  lessonId: string | null;
  sessionId: string | null;
  youtubeUrl: string;
  videoId: string;
  playlistId: string | null;
  isPlaylist: boolean;
  title: string | null;
  channel: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null; // oEmbed does not provide this; null is honest
  metadataStatus: 'verified' | 'unverified' | 'failed';
  metadataCheckedAt: string | null;
  note?: string | null;
  orderIndex: number;
  createdBy: string | null;
}

export interface SubtitleFile {
  id: string;
  lessonId: string | null;
  videoId: string | null;
  language: string;
  fileName: string;
  storagePath: string;
  vtt: string;
  checked: boolean;
  checkedAt: string | null;
  checkedBy: string | null;
  captionStatus: CaptionStatus;
  updatedAt: string;
}

/* Instructor-supplied assets: images, external links, uploaded material. */
export interface LessonAsset {
  id: string;
  lessonId: string;
  kind: 'image' | 'link' | 'file';
  title: string;
  url: string;
  createdAt: string;
}

export interface StudentLessonDetail extends Lesson {
  completed: boolean;
  completedAt: string | null;
  videos: VideoResource[];
  subtitles: SubtitleFile[];   // only checked/published tracks are sent as captions
  assets: LessonAsset[];
  sessionTitle: string;
}

export interface StudentSessionDetail {
  session: SessionSummary;
  lessons: { id: string; slug: string; title: string; orderIndex: number; minutes: number; completed: boolean; published: boolean }[];
  exam: { id: string; title: string; minutes: number; requiresCode: boolean; passed: boolean; bestScore: number | null; attempts: number } | null;
  project: ProjectBrief | null;
}

export interface DashboardData {
  profile: PublicProfile;
  greetingName: string;
  overallPercent: number;
  lessonsCompleted: number;
  lessonsTotal: number;
  sessionsCompleted: number;
  sessionsTotal: number;
  currentSession: SessionSummary | null;
  currentLesson: { id: string; title: string; sessionTitle: string } | null;
  completedSessions: SessionSummary[];
  upcomingSessions: SessionSummary[];
  examinationStatus: { sessionTitle: string; status: 'not_started' | 'in_progress' | 'failed' | 'passed'; bestScore: number | null; attempts: number }[];
  achievements: { id: string; title: string; detail: string; earnedAt: string; icon: string }[];
  pendingQuestions: HelpRequestView[];
  answeredQuestions: HelpRequestView[];
  notifications: NotificationView[];
  activeAttempt: { id: string; examId: string; sessionTitle: string; startedAt: string; endsAt: string } | null;
  sessions: SessionSummary[];
}

export interface HelpRequestView {
  id: string;
  question: string;
  status: QuestionStatus;
  sessionTitle: string | null;
  lessonTitle: string | null;
  sessionId: string | null;
  lessonId: string | null;
  createdAt: string;
  answeredAt: string | null;
  answer: string | null;
  answeredVia: 'in_app' | 'whatsapp' | 'manual' | null;
  whatsappUrl: string;
}

export interface NotificationView {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  kind: 'answer' | 'exam' | 'system';
}

/* ── Examinations ──────────────────────────────────────────────────────── */

export interface ExamQuestionPublic {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];          // shuffled by the server per attempt
  points: number;
  difficulty: 'core' | 'applied' | 'hard';
  objective: string;
  requiresCode: boolean;
  language?: CodeSnippet['language'];
  starterCode?: string;
  taskInstructions?: string;
  visibleTests?: { name: string; input: unknown[]; expected: unknown }[];
  contextCode?: string;
  maxChars?: number;
}

export interface ExamSheet {
  attemptId: string;
  examId: string;
  title: string;
  sessionTitle: string;
  variantLabel: string;
  variantIndex: number;
  startedAt: string;
  endsAt: string;
  minutes: number;
  passMark: number;
  practicalPass: number;
  requiresCode: boolean;
  questions: ExamQuestionPublic[];
  integrityNotice: string;
  answers?: Record<string, string>;   // in-progress answers saved server-side for resume
}

export interface QuestionGrade {
  questionId: string;
  awarded: number;
  available: number;
  correct: boolean;
  feedback: string;
  correctAnswer?: string;
  explanation?: string;
}

export interface ExamResult {
  attemptId: string;
  score: number;              // percent
  practicalScore: number | null;
  passMark: number;
  practicalPass: number;
  passed: boolean;
  gradedAt: string;
  grades: QuestionGrade[];
  variantLabel: string;
  canRetake: boolean;
  nextSessionUnlocked: boolean;
}

export interface AttemptSummary {
  id: string;
  examId: string;
  examTitle: string;
  sessionTitle: string;
  variantLabel: string;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  practicalScore: number | null;
  passed: boolean;
}

/* ── Instructor ────────────────────────────────────────────────────────── */

export interface InstructorOverview {
  student: { displayName: string; accountId: string; joinedAt: string; lastActiveAt: string | null };
  overallPercent: number;
  lessonsCompleted: number;
  lessonsTotal: number;
  completedSessions: number;
  currentSession: string | null;
  currentLesson: string | null;
  attempts: AttemptSummary[];
  failedAttempts: AttemptSummary[];
  strugglingAreas: { objective: string; sessionTitle: string; correct: number; total: number }[];
  helpPending: number;
  videosWithoutCaptions: number;
  unverifiedVideos: number;
}

export interface QuestionBankItem {
  id: string;
  examId: string;
  variantGroup: string;
  type: QuestionType;
  prompt: string;
  points: number;
  difficulty: 'core' | 'applied' | 'hard';
  objective: string;
  approved: boolean;
  published: boolean;
  hasHiddenTests: boolean;
  updatedAt: string;
  /* answer material is only returned to instructors */
  correctAnswer?: string;
  explanation?: string;
  options?: string[];
  hiddenTests?: { name: string; input: unknown[]; expected: unknown }[];
  taskInstructions?: string;
  starterCode?: string;
}

export interface ApiError { error: string; code?: string }
