-- DANIELLACODES — Supabase / PostgreSQL foundation
-- Apply in order: 0001_init.sql then 0002_storage.sql
-- Public sign-up must be DISABLED in Supabase Auth dashboard. Two Auth users
-- are created manually; see supabase/README.md.

create extension if not exists "pgcrypto";

-- ── Identity ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  account_id text unique not null,
  display_name text not null,
  role text not null check (role in ('student','instructor')),
  password_hash text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);
comment on column public.profiles.password_hash is 'Local-driver only. Never selected into any API response.';

-- SECURITY DEFINER breaks the recursion that a self-referencing RLS policy
-- on profiles would otherwise create.
create or replace function public.is_instructor()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid() and role = 'instructor'
  );
$$;

create or replace function public.my_profile_id()
returns uuid language sql stable security definer
set search_path = public as $$
  select id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

-- ── Curriculum ───────────────────────────────────────────────────────────
create table if not exists public.sessions (
  id text primary key,
  order_index integer not null unique,
  slug text not null,
  title text not null,
  subtitle text not null,
  description text not null,
  minutes integer not null,
  project_json jsonb not null default '{}'::jsonb,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  slug text not null,
  order_index integer not null,
  title text not null,
  minutes integer not null,
  content_json jsonb not null,
  topics_json jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (session_id, slug)
);
create index if not exists idx_lessons_session on public.lessons(session_id, order_index);

create table if not exists public.lesson_assets (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null references public.lessons(id) on delete cascade,
  kind text not null check (kind in ('image','link','file')),
  title text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.video_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id text references public.lessons(id) on delete cascade,
  session_id text references public.sessions(id) on delete cascade,
  youtube_url text not null,
  video_id text not null,
  playlist_id text,
  is_playlist boolean not null default false,
  title text,
  channel text,
  thumbnail_url text,
  duration_seconds integer,
  metadata_status text not null default 'unverified' check (metadata_status in ('verified','unverified','failed')),
  metadata_checked_at timestamptz,
  note text,
  order_index integer not null default 0,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists idx_videos_lesson on public.video_resources(lesson_id);

create table if not exists public.subtitle_files (
  id uuid primary key default gen_random_uuid(),
  lesson_id text references public.lessons(id) on delete cascade,
  video_id text,
  language text not null default 'en',
  file_name text not null,
  storage_path text not null,
  vtt text not null,
  checked boolean not null default false,
  checked_at timestamptz,
  checked_by uuid,
  caption_status text not null default 'not_supplied' check (caption_status in ('not_supplied','uploaded','checked','published')),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subtitles_lesson on public.subtitle_files(lesson_id);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id text not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (profile_id, lesson_id)
);
create index if not exists idx_progress_profile on public.lesson_progress(profile_id);

-- ── Examinations ─────────────────────────────────────────────────────────
create table if not exists public.exams (
  id text primary key,
  session_id text not null references public.sessions(id) on delete cascade,
  title text not null,
  brief text not null,
  minutes integer not null,
  pass_mark integer not null default 80,
  practical_pass integer not null default 0,
  question_count integer not null default 10,
  requires_code boolean not null default false,
  manual_review boolean not null default false,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.question_bank (
  id text primary key,
  exam_id text not null references public.exams(id) on delete cascade,
  objective text not null,
  type text not null check (type in ('mcq','short','code_reading','debug','scenario','coding')),
  difficulty text not null check (difficulty in ('core','applied','hard')),
  points integer not null,
  prompt text not null,
  variants_json jsonb not null default '[]'::jsonb,
  options_json jsonb,
  correct_index integer,
  rubric_json jsonb,
  explanation text not null,
  approved boolean not null default false,
  published boolean not null default false,
  language text,
  starter_code text,
  task_instructions text,
  context_code text,
  visible_tests_json jsonb,
  hidden_tests_json jsonb,
  static_checks_json jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists idx_questions_exam on public.question_bank(exam_id);

create table if not exists public.exam_variants (
  id uuid primary key default gen_random_uuid(),
  exam_id text not null references public.exams(id) on delete cascade,
  label text not null,
  variant_index integer not null,
  seed integer not null,
  question_ids_json jsonb not null,
  unique (exam_id, variant_index)
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  exam_id text not null references public.exams(id) on delete cascade,
  variant_id uuid not null,
  variant_index integer not null,
  status text not null default 'active' check (status in ('active','submitted','graded','abandoned','awaiting_review')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  submitted_at timestamptz,
  score numeric,
  practical_score numeric,
  passed boolean not null default false,
  manual_review boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  answers_json jsonb not null default '{}'::jsonb,
  question_snapshot_json jsonb not null default '[]'::jsonb,
  grades_json jsonb
);
create index if not exists idx_attempts_profile on public.exam_attempts(profile_id, exam_id);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  question_id text not null,
  profile_id uuid not null,
  code text not null,
  language text not null,
  output_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.coding_test_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  attempt_id uuid not null,
  question_id text not null,
  test_name text not null,
  passed boolean not null,
  message text,
  hidden boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Support ──────────────────────────────────────────────────────────────
create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  session_id text references public.sessions(id),
  lesson_id text references public.lessons(id),
  question text not null,
  status text not null default 'pending' check (status in ('pending','answered')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  answer text,
  answered_by uuid,
  answered_via text
);
create index if not exists idx_help_profile on public.help_requests(profile_id, created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  message text not null,
  read boolean not null default false,
  related_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  title text not null,
  detail text not null,
  icon text not null,
  earned_at timestamptz not null default now(),
  unique (profile_id, key)
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target text,
  detail_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value text not null
);

-- ── Row Level Security ───────────────────────────────────────────────────
-- Public content is readable by any authenticated user. All private rows are
-- restricted to their owner, with instructor overrides. The service-role key
-- used by the Express server bypasses these policies by design; the server
-- enforces the same rules in middleware, giving two independent layers.

alter table public.profiles            enable row level security;
alter table public.sessions            enable row level security;
alter table public.lessons             enable row level security;
alter table public.lesson_assets       enable row level security;
alter table public.video_resources     enable row level security;
alter table public.subtitle_files      enable row level security;
alter table public.lesson_progress     enable row level security;
alter table public.exams               enable row level security;
alter table public.question_bank       enable row level security;
alter table public.exam_variants       enable row level security;
alter table public.exam_attempts       enable row level security;
alter table public.submissions         enable row level security;
alter table public.coding_test_results enable row level security;
alter table public.help_requests       enable row level security;
alter table public.notifications       enable row level security;
alter table public.achievements        enable row level security;
alter table public.audit_log           enable row level security;
alter table public.settings            enable row level security;

create policy "profile_self_or_instructor" on public.profiles
  for select using (auth_user_id = auth.uid() or public.is_instructor());
create policy "profile_no_client_writes" on public.profiles
  for update using (public.is_instructor()) with check (public.is_instructor());

create policy "published_sessions_read" on public.sessions
  for select using (published or public.is_instructor());
create policy "published_lessons_read" on public.lessons
  for select using (published or public.is_instructor());
create policy "assets_read" on public.lesson_assets
  for select using (true);
create policy "videos_read" on public.video_resources
  for select using (true);
create policy "checked_subtitles_read" on public.subtitle_files
  for select using (caption_status in ('checked','published') or public.is_instructor());
create policy "exam_catalog_read" on public.exams
  for select using (published or public.is_instructor());

-- A student must NEVER be able to read answer material or hidden tests.
create policy "questions_no_student_read" on public.question_bank
  for select using (public.is_instructor());
create policy "variants_no_student_read" on public.exam_variants
  for select using (public.is_instructor());

create policy "own_progress" on public.lesson_progress
  for all using (profile_id = public.my_profile_id() or public.is_instructor())
  with check (profile_id = public.my_profile_id() or public.is_instructor());
create policy "own_attempts_read" on public.exam_attempts
  for select using (profile_id = public.my_profile_id() or public.is_instructor());
create policy "own_help" on public.help_requests
  for select using (profile_id = public.my_profile_id() or public.is_instructor());
create policy "own_notifications" on public.notifications
  for select using (profile_id = public.my_profile_id() or public.is_instructor());
create policy "own_notifications_update" on public.notifications
  for update using (profile_id = public.my_profile_id());
create policy "own_achievements" on public.achievements
  for select using (profile_id = public.my_profile_id() or public.is_instructor());

-- Only instructors may manage curriculum, exams, questions, subtitles,
-- assets, results, audit records and settings.
create policy "instructor_manage" on public.sessions for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_lessons" on public.lessons for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_assets" on public.lesson_assets for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_videos" on public.video_resources for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_subtitles" on public.subtitle_files for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_exams" on public.exams for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_questions" on public.question_bank for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_variants" on public.exam_variants for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_attempts" on public.exam_attempts for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_submissions" on public.submissions for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_results" on public.coding_test_results for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_help" on public.help_requests for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_achievements" on public.achievements for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_audit" on public.audit_log for all using (public.is_instructor()) with check (public.is_instructor());
create policy "instructor_manage_settings" on public.settings for all using (public.is_instructor()) with check (public.is_instructor());

-- Grants: authenticated clients get the minimum; the server uses service_role.
grant usage on schema public to authenticated;
grant select on public.profiles, public.sessions, public.lessons, public.lesson_assets,
  public.video_resources, public.subtitle_files, public.exams, public.lesson_progress,
  public.exam_attempts, public.help_requests, public.notifications, public.achievements
  to authenticated;
grant insert, update on public.lesson_progress, public.help_requests, public.notifications to authenticated;
