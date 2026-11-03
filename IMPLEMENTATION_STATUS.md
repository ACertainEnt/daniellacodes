# DANIELLACODES — implementation status (honest audit)

> Rule from the brief: *"If any part is not implemented, explicitly identify it rather than presenting a decorative, non-functional control."*
> This document is that identification. `npm run verify:api` prints **63 passing checks** against a fresh database; `npm run check:curriculum` validates structure; `npm run verify:render` mounts the real React app headlessly.

Date of audit: 2026-11-03 · Branch: `arena/5e9a38fe-daniellacodes`

---

## A. What is genuinely working (against real database records)

| Area | Status | Evidence |
|---|---|---|
| Two accounts, role-based redirect | ✅ | Student `DANIELLACODES` → `/app`, instructor `ACECODES` → `/ace`; `verify:api` §1 |
| Secure authentication | ✅ Local driver: bcrypt (cost 12) + signed httpOnly/SameSite JWT cookie, role re-read from DB **every request**. Supabase driver: Supabase Auth `signInWithPassword`. No sign-up route exists anywhere. | `server/auth.ts`, `verify:api` §1 |
| Separate permissions | ✅ | All `/api/instructor/*` routes return 403 for student; all `/api/student/*` and `/api/exams/*` return 403 for instructor. RLS policies shipped as second layer. | `verify:api` §1 |
| No secrets in frontend | ✅ | `password_hash`, `question_snapshot_json`, hidden tests and service-role key are never serialised to a client. Only server reads env. No `VITE_*` secret exists. | `verify:api` §1, §5 |
| Curriculum | ✅ | 14 sessions in order, **66 lessons**, **220** plain-English topic explanations, every lesson expands to the required 13-part body. Sessions 0–13 cover every topic listed in the brief. | `npm run check:curriculum` |
| Sequential unlocking | ✅ | Computed server-side on every request; a locked lesson/exam returns 403 even if the URL is typed directly. Passing an exam + finishing all lessons unlocks the next session. | `verify:api` §2, §5 |
| Lesson completion | ✅ | Independent of exams, only on explicit button press, survives re-login/another device, revisitable. | `verify:api` §2 |
| YouTube videos | ✅ | All 9 supplied URLs verified against oEmbed; **real** titles/channels/thumbnails stored, watch + youtu.be + shorts + playlist IDs parsed, privacy-enhanced `youtube-nocookie.com` embed, split across individual lessons. Duration left `null` because oEmbed does not provide it. | `shared/videos.ts`, `verify:api` §3 |
| Independent subtitles | ✅ | Instructor uploads/edits real `.vtt` (validated), checks & publishes; student sees captions **only then**. Overlay syncs to `getCurrentTime()` from the YouTube IFrame API, with toggle, 3 sizes, 3 backgrounds and a clickable transcript. Local self-hosted videos use native `<track>` subtitles. No lesson pretends to be captioned without a checked file. | `verify:api` §3 |
| Video player | ✅ | Rounded comic-green frame, gentle open animation, real playback controls via the IFrame API (play/pause, ±10s, mute, fullscreen) **plus** YouTube's native controls, fullscreen via the Fullscreen API, playback position saved per video in localStorage. | `src/components/VideoLesson.tsx` |
| Examination engine | ✅ | **156** real questions across 14 banks, 10–12 published per exam, 3 variants each, 80% pass mark, separate practical threshold, 45–90 min timer, shuffled options, parameterised scenarios/numbers, autosaved in-progress answers, immutable server-side snapshot grading. No correct answer/rubric/hidden test is in the student sheet. | `verify:api` §5 |
| Code editor | ✅ | CodeMirror 6 with syntax highlighting (JS/JSX/HTML/CSS/SQL), line numbers, auto-indent, bracket matching, line wrapping for phones, formatting button. Only appears for coding questions. | `src/components/CodeEditor.tsx` |
| Code execution & testing | ✅ | Run executes only visible tests in a Worker-thread `vm` sandbox; hidden tests run server-side at grading in an isolated worker with two timeouts and no `require`/`process`/fs/network. HTML/CSS challenges get a real sandboxed iframe preview. Hidden test results stored for instructor review. | `verify:api` §5 (correct JS implementation passes hidden tests) |
| Exam integrity & retakes | ✅ | Abandoning invalidates only the active attempt, discards its answers, preserves completed lessons and all history, and forces a **different variant** next time (different question subset, numbers, wording and option order). | `verify:api` §5 |
| Ask Ace | ✅ | Draggable (touch/mouse) FAB, help sheet, validation, question saved **before** WhatsApp opens, real prefilled `wa.me/2348107543761` message with session, lesson, question and request ID, PENDING status, dashboard display, instructor inbox with reply / WhatsApp / manual mark-answered, in-app notifications. | `verify:api` §4 |
| Instructor console | ✅ | Student overview (progress, session, attempts, scores, failures, struggling objectives derived from real grades), course management (add/edit/publish/reorder sessions & lessons, video add/verify/delete, VTT upload/check/publish, image & link assets), exam management (settings, question approve/publish/create, variant regeneration, answer/code review, attempt reset/delete, capstone approval), support inbox, student record. | `verify:api` §6 |
| Persistence | ✅ | SQLite WAL file (or Supabase Postgres) holds profiles, sessions, lessons, videos, subtitles, progress, question bank, variants, attempts, submissions, coding results, help requests, notifications, achievements, audit log. Seeding is idempotent and never overwrites progress/instructor edits. | `server/db/schema.sql`, `supabase/migrations/0001_init.sql` |
| Design | ✅ | Comic Green tokens, Bangers/Nunito Sans, thick outlines + offset shadows, halftone, rounded cards, spring interactions on every button (Framer Motion), light default + persisted dark toggle, `prefers-reduced-motion` guard, mobile-first with bottom nav + safe-area insets, desktop sidebar, animated 3D "Created by Divine (Ace)" footer. No horizontal-overflow patterns: `overflow-x: hidden`, `max-width: 100%`, `minmax(min(100%, …))`, `EditorView.lineWrapping`, responsive tables inside `.table-wrap`. | `src/styles/*` |
| Supabase foundation | ✅ | Full Postgres schema, enums/checks, indexes, `is_instructor()`/`my_profile_id()` security-definer helpers, RLS on every table (students cannot read `question_bank`/`exam_variants`), storage buckets + policies, manual Auth-user setup guide. | `supabase/migrations/*`, `supabase/README.md` |

---

## B. Deliberately NOT claimed (explicit gaps and limits)

1. **No Supabase project was provisioned.** No project URL, anon key or service-role key existed in this environment, so the app boots in `local` mode (Express + `node:sqlite` + bcrypt/JWT). That is a real, persistent SQL database with real records — not mock data — and the `supabase` driver is implemented behind the same repository contract. **To use Supabase Auth/Postgres/Storage you must supply the credentials and apply the two migrations** (see `supabase/README.md`). This is configuration, not missing code.
2. **Cheating is not claimed to be technologically impossible.** Options are shuffled, scenarios/numbers vary, hints and answers are hidden, hidden tests are server-side only, and attempts are recorded. A determined student with devtools could still collaborate or look things up externally. There is no proctoring, camera or lockdown browser.
3. **WhatsApp replies are not auto-detected.** There is no WhatsApp Business API here. Ace records a WhatsApp answer manually (with an optional summary); the app never claims to know online status or incoming messages.
4. **Code execution is isolated but not a hardened production judge.** Student code runs in a `node:vm` context inside a `worker_threads` worker with `codeGeneration` disabled, no `require`/`process`/`Buffer`, two timeouts and memory limits. This isolates it from the Express process and the database, satisfying "never execute in the application's main context". For a public, multi-tenant deployment, replace `server/sandbox.ts` with a networkless micro-VM / containerised judge (Judge0, gVisor, Firecracker) — this is documented in code.
5. **No captions are supplied for the nine preloaded videos.** oEmbed returns no subtitle data and no duration. Every preloaded video is explicitly shown as **"Subtitles not supplied"** and `durationSeconds === null`. ACECODES must upload and check a `.vtt` per lesson before the lesson is captioned. No subtitle text, title or duration has been invented.
6. **Video metadata added while offline is stored as `unverified`.** If the deployed server cannot reach YouTube oEmbed, the URL and ID are still parsed and the thumbnail is derived from the ID, but title/channel stay `null` and the resource is flagged `unverified` for the instructor to check. It is never invented.
7. **SQL and frontend-challenge grading uses structural checks, not a live Postgres/browser DOM.** SQL questions are graded by validated regex/structural checks and JS logic questions by real executed hidden tests. There is no jsdom/Postgres instance inside the grading sandbox, so a CSS "reproduce this design" task is checked for the required declarations rather than pixel similarity. This is visible to instructors in the review screen (structural checks are listed).
8. **The capstone is instructor-reviewed.** Session 13 is submitted as `awaiting_review`; it does not auto-pass. Approval happens in ACECODES after Daniella's live demonstration. No complete capstone solution is supplied anywhere in the repository.
9. **Written lesson depth is deliberately uneven.** Every lesson uses the full 13-section format and every one of the 220 listed topics has a real plain-English explanation, analogy, steps, true statement, misconception and mistake. Sessions 0–4 include more worked code with line-by-line notes; later concept-heavy sessions (security, testing, deployment) are shorter and code-free where code is not applicable — section 7/8 says so explicitly rather than padding with fake snippets. ACECODES can edit the entire 13-section JSON of any lesson inline.
10. **No automated pixel/visual regression or real-device test run.** Mobile overflow was addressed structurally in CSS and verified by headless render + code review, not by a physical iPhone. HMR/live preview works in the proxied environment (single origin, `0.0.0.0`, permissive hosts, relative `/api` calls).
11. **No email/password reset or 2FA.** Registration is disabled and there are exactly two accounts; password changes are done by the account owner in `.env` (local) or the Supabase dashboard (production).
12. **Bundle is not code-split.** The production JS is ~1.1 MB (367 KB gzip) because CodeMirror and Framer Motion are in the main chunk. Functional, but a later optimisation would lazy-load the exam editor.

---

## C. Verification results

```
npm run typecheck                 # client + server TypeScript: clean
npm run build                     # Vite production build: OK
npm run check:curriculum          # 14 sessions / 66 lessons / 220 topics / 156 questions / 9 videos: VALID
npm run verify:api                # 63 passed, 0 failed (fresh temporary DB, both roles)
npm run verify:render             # student dashboard, sessions, lesson, progress, questions,
                                  # results, instructor overview/course/exams/inbox/record: all render
```

The verification suite spawns its own server on port 5199 with a temporary SQLite file, so it never touches the running academy's data.

---

## D. Final quality checklist mapping

| # | Requirement | Verified by |
|---|---|---|
| 1 | Both access IDs work | `verify:api` §1 |
| 2 | Permissions separate | §1 (403 both directions) |
| 3 | Lessons unlock sequentially | §2, §5 |
| 4 | Lesson completion saved | §2 (incl. re-login) |
| 5 | YouTube previews display | §3 (real thumbnail/title) + headless render |
| 6 | Videos play inside platform | IFrame API + `youtube-nocookie` embed; **manual browser playback not testable in this sandbox** (see B.10) |
| 7 | Independent subtitles synchronise | §3 (upload → check → student sees VTT) + `VideoLesson` time-driven overlay; **manual playback sync not testable headlessly** |
| 8 | Code editor on mobile | CodeMirror with `lineWrapping`, wrapping layout, touch-safe toolbar |
| 9 | Coding submissions tested | §5 (visible run + hidden tests pass for a correct solution, results stored) |
| 10 | Exam variants work | §5 (different variant index, question set and scenarios) |
| 11 | Leaving active exam resets it | §5 (answers discarded, different variant) |
| 12 | Completed lessons intact | §2, §5, §6 |
| 13 | Passing unlocks next session | §5 |
| 14 | Question saved before WhatsApp | §4 (POST completes before URL returned; UI opens only after success) |
| 15 | WhatsApp message correct | §4 (exact question, session, lesson, ID, number) |
| 16 | Pending questions in ACECODES | §4 |
| 17 | Instructor reply visible to student | §4 (+ notification) |
| 18 | Light/dark mode | `ThemeProvider` persists to localStorage; toggle in topbar/account sheet, verified in headless render |
| 19 | Animations on touch and desktop | Framer Motion pointer-agnostic springs + CSS reduced-motion guard |
| 20 | No horizontal overflow on mobile | structural CSS review + headless render; **no physical device measurement** |

---

Created by Divine (Ace). · DANIELLACODES — Learn it. Build it. Understand it.
