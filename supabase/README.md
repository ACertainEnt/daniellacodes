# Supabase setup (production mode)

The app runs today with the local SQLite driver. To switch to Supabase Auth + PostgreSQL + Storage:

1. **Create a project.** Copy `.env.example` to `.env` and set:
   ```
   DATA_DRIVER=supabase
   AUTH_MODE=supabase
   SUPABASE_URL=https://<project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service-role key>   # SECRET, server only
   SUPABASE_ANON_KEY=<anon key>                   # public, safe
   ```
   Never prefix the service-role key with `VITE_`. It is read only inside `server/`.

2. **Apply migrations in order** in the Supabase SQL editor (or `supabase db push`):
   `migrations/0001_init.sql` then `migrations/0002_storage.sql`.
   These create every table, index, the `is_instructor()` / `my_profile_id()` helper
   functions, all RLS policies and the two Storage buckets.

3. **Disable public registration.** Authentication → Providers → Email: enable email,
   but turn off "Allow new users to sign up". There is no sign-up endpoint in the app.

4. **Create exactly two Auth users manually** (Authentication → Users → Add user):
   | Auth email (internal) | Account ID used at login | Role |
   |---|---|---|
   | `daniellacodes@daniellacodes.local` | `DANIELLACODES` | `student` |
   | `acecodes@daniellacodes.local` | `ACECODES` | `instructor` |

   The login form asks for the **account ID**, not the email. `server/auth.ts` maps
   the account ID to its internal email via `profiles.account_id`. Set each password
   in the dashboard; do not store it in the repository.

5. **Link the UIDs to profiles.** After seeding (or manually), set `auth_user_id`:
   ```sql
   update public.profiles set auth_user_id = '<daniella-auth-uuid>' where account_id = 'DANIELLACODES';
   update public.profiles set auth_user_id = '<ace-auth-uuid>'       where account_id = 'ACECODES';
   ```
   Roles come from this table on every request — never from a client field or
   from a token claim the client could influence.

6. **Configure Auth URLs.** Authentication → URL Configuration: set Site URL to your
   production URL and add the redirect URLs you use. Enable email confirmation off
   for these two manually-created users (or confirm them manually).

7. **Restart the app.** `server/seed.ts` is idempotent and will fill curriculum,
   verified video resources and the exam bank if those tables are empty.

### Security notes
- The service-role key **bypasses RLS**. All API routes also enforce roles through
  `requireRole` middleware, so authorisation does not depend on a single layer.
- `question_bank` and `exam_variants` have no student SELECT policy: correct
  answers, rubrics and hidden test cases cannot be read by a student, even with a
  valid session.
- `exam_attempts.question_snapshot_json` holds answer material for grading; it is
  never serialised into any student-facing response.
- Storage `subtitles` is private; the app serves checked `.vtt` content through an
  authenticated route rather than exposing raw object URLs.
