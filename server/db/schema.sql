-- DANIELLACODES local runtime schema (SQLite).
-- Column names deliberately match the PostgreSQL/Supabase migration 1:1 so
-- both drivers implement the same repository contract.

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  auth_user_id TEXT UNIQUE,
  account_id TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student','instructor')),
  password_hash TEXT,                       -- server-only, never serialised to a client
  created_at TEXT NOT NULL,
  last_active_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  order_index INTEGER NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  description TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  project_json TEXT NOT NULL DEFAULT '{}',
  published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  content_json TEXT NOT NULL,               -- full 13-section LessonContent
  topics_json TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE (session_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_lessons_session ON lessons(session_id, order_index);

CREATE TABLE IF NOT EXISTS lesson_assets (
  id TEXT PRIMARY KEY,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image','link','file')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS video_resources (
  id TEXT PRIMARY KEY,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  youtube_url TEXT NOT NULL,
  video_id TEXT NOT NULL,
  playlist_id TEXT,
  is_playlist INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  channel TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,                 -- null: oEmbed does not provide duration
  metadata_status TEXT NOT NULL DEFAULT 'unverified',
  metadata_checked_at TEXT,
  note TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_videos_lesson ON video_resources(lesson_id);

CREATE TABLE IF NOT EXISTS subtitle_files (
  id TEXT PRIMARY KEY,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
  video_id TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  vtt TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT,
  checked_by TEXT,
  caption_status TEXT NOT NULL DEFAULT 'not_supplied',
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subtitles_lesson ON subtitle_files(lesson_id);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at TEXT NOT NULL,
  UNIQUE (profile_id, lesson_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_profile ON lesson_progress(profile_id);

CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  minutes INTEGER NOT NULL,
  pass_mark INTEGER NOT NULL DEFAULT 80,
  practical_pass INTEGER NOT NULL DEFAULT 0,
  question_count INTEGER NOT NULL DEFAULT 10,
  requires_code INTEGER NOT NULL DEFAULT 0,
  manual_review INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  objective TEXT NOT NULL,
  type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  points INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  variants_json TEXT NOT NULL DEFAULT '[]',
  options_json TEXT,
  correct_index INTEGER,
  rubric_json TEXT,
  explanation TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  language TEXT,
  starter_code TEXT,
  task_instructions TEXT,
  context_code TEXT,
  visible_tests_json TEXT,
  hidden_tests_json TEXT,
  static_checks_json TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON question_bank(exam_id);

CREATE TABLE IF NOT EXISTS exam_variants (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  variant_index INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  question_ids_json TEXT NOT NULL,
  UNIQUE (exam_id, variant_index)
);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  variant_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  submitted_at TEXT,
  score REAL,
  practical_score REAL,
  passed INTEGER NOT NULL DEFAULT 0,
  manual_review INTEGER NOT NULL DEFAULT 0,
  reviewed_by TEXT,
  reviewed_at TEXT,
  answers_json TEXT NOT NULL DEFAULT '{}',
  question_snapshot_json TEXT NOT NULL DEFAULT '[]',  -- SERVER ONLY: includes answers + hidden tests
  grades_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_attempts_profile ON exam_attempts(profile_id, exam_id);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  code TEXT NOT NULL,
  language TEXT NOT NULL,
  output_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coding_test_results (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  test_name TEXT NOT NULL,
  passed INTEGER NOT NULL,
  message TEXT,
  hidden INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS help_requests (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id),
  lesson_id TEXT REFERENCES lessons(id),
  question TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  answered_at TEXT,
  answer TEXT,
  answered_by TEXT,
  answered_via TEXT
);
CREATE INDEX IF NOT EXISTS idx_help_profile ON help_requests(profile_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  related_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  icon TEXT NOT NULL,
  earned_at TEXT NOT NULL,
  UNIQUE (profile_id, key)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  target TEXT,
  detail_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
