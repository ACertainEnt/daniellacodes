# DANIELLACODES

> **Learn it. Build it. Understand it.**
> A private, mobile-first full-stack engineering academy for one student (Daniella) and one instructor (Divine / Ace).

This repository is a **working application**, not a landing page mockup. It has real accounts, real database records, server-enforced roles, sequential unlocking, an examination engine with variant generation and graded code submissions, YouTube lessons with independent VTT subtitles, an Ask Ace → WhatsApp help flow, and a separate instructor console.

---

## 1. Repository state at the start of this build

Confirmed: the checkout contained only `README.md` (36 bytes, "coding instructions") at commit `bea8ecc`. No application, framework, database, or behaviour existed to preserve. This is a greenfield build.

---

## 2. Architecture and technology choices

### The one important deployment decision

The specification asks for **Supabase Auth, Supabase PostgreSQL, RLS and Storage**. Those require a Supabase project and credentials that are not present in this environment. A decorative frontend that *pretends* to talk to Supabase would violate the brief ("Do not build a static landing-page mockup", "Use real database records"). So the app has **two interchangeable server-side data/auth drivers behind one repository interface**:

| | `local` driver (default, runs today) | `supabase` driver (production target) |
|---|---|---|
| Database | SQLite via Node 22's built-in `node:sqlite` — a real SQL database with a real on-disk file | Supabase PostgreSQL via `supabase-js` **service-role client, server-side only** |
| Auth | `bcryptjs` password hashes + signed `httpOnly` JWT cookie | Supabase Auth `signInWithPassword`; server verifies the token and reads the role |
| Files | Local `storage/` directory (lesson assets, `.vtt`) | Supabase Storage buckets (`lesson-assets`, `subtitles`) |
| Access control | Express middleware `requireRole`, roles read from DB on every request | Same middleware **plus** the shipped Row Level Security policies |
| Registration | None. Two accounts seeded from env vars. | None. Two Auth users created manually; no sign-up endpoint. |

**Set `DATA_DRIVER=supabase` + `AUTH_MODE=supabase` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` to switch.** Application code, routes and UI do not change. `supabase/migrations/*.sql` contains the complete Postgres schema, enums, indexes, triggers, RLS policies and storage buckets.

> The service-role key is read only inside `server/`. No `VITE_`-prefixed secret exists. The frontend never receives a service-role key, password hash, hidden test case, or correct exam answer before grading.

### Stack

- **React 19 + TypeScript + Vite 7** — SPA with `react-router-dom`.
- **Express 4** — one process. In development it mounts Vite in middleware mode, so there is a single origin and a single port; the browser only ever calls relative `/api/...` URLs. In production it serves `dist/`.
- **Framer Motion** — spring interactions on every button, sheet, card and menu; `useReducedMotion()` disables them.
- **CodeMirror 6** — mobile-capable exam editor (syntax highlighting, line numbers, auto-indent, bracket matching).
- **YouTube IFrame Player API** — privacy-enhanced (`youtube-nocookie.com`) embeds, with an **independent VTT overlay** driven by `getCurrentTime()`.
- **Sandboxed execution** — student code runs in a `sandbox="allow-scripts"` iframe Web Worker (client "Run"), and grading runs in a `node:vm` context inside a `worker_threads` worker with a hard timeout and no filesystem/network/process objects (server). Hidden tests live only on the server. See *Known limits* below.
- **Bespoke CSS** — no UI kit. Comic Green tokens, thick outlines, offset shadows, halftone, safe-area insets, dark mode.

### Why one Express + Vite process
Live previews and mobile testing need one stable origin. A separate frontend/backend split would force the browser to call `localhost`, which does not work in a proxied preview. Everything is same-origin, cookie-based, and mobile-safe from the start.

---

## 3. Project structure

```
daniellacodes/
├── index.html                      fonts, viewport-fit=cover, theme-color
├── vite.config.ts                  React plugin, @ / @shared aliases, permissive hosts
├── shared/
│   ├── types.ts                    all domain + API contracts (client & server)
│   ├── topics.ts                   plain-English teaching library (every listed topic)
│   ├── curriculum.ts               14 sessions → lessons → 13-section lesson bodies
│   ├── exams.ts                    real question bank + variant parameterisation
│   └── videos.ts                   9 verified YouTube resources (real oEmbed metadata)
├── server/
│   ├── index.ts                    Express + Vite middleware + route mounting
│   ├── env.ts                      server-only configuration
│   ├── auth.ts                     login, cookie, requireUser / requireRole, never leaks hashes
│   ├── db/
│   │   ├── index.ts                driver selector + generic repository interface
│   │   ├── schema.sql              SQLite DDL (all tables + indexes)
│   │   ├── sqlite.ts               prepared-statement driver, JSON column codec
│   │   └── supabase.ts             server-side service-role driver (same interface)
│   ├── seed.ts                     idempotent seeding of accounts, curriculum, videos, exams
│   ├── youtube.ts                  watch / youtu.be / playlist ID parsing + oEmbed
│   ├── sandbox.ts                  worker-thread vm runner for grading
│   ├── grading.ts                  MCQ, short-answer rubric, hidden code tests, variant builder
│   └── routes/
│       ├── auth.ts                 login / logout / me
│       ├── student.ts              dashboard, sessions, lessons, progress, unlock state
│       ├── exams.ts                start / questions / run / submit / abandon / results
│       ├── help.ts                 Ask Ace requests + replies + notifications
│       ├── media.ts                video metadata, subtitle CRUD, local storage uploads
│       └── instructor.ts           overview, curriculum CRUD, exam CRUD, inbox, resets
├── supabase/
│   ├── migrations/0001_init.sql    Postgres schema, RLS, triggers, indexes
│   ├── migrations/0002_storage.sql buckets + storage policies
│   └── README.md                   how to create the two Auth users and link profiles
├── src/
│   ├── main.tsx, App.tsx           providers + routes + role guards
│   ├── styles/                     tokens, comic components, layouts, animations
│   ├── lib/                        api client, auth/theme contexts, youtube, whatsapp, motion
│   ├── components/                 Shell, ComicCard, BouncyButton, ProgressRing,
│   │                               SessionCard, Footer, AskAce, VideoLesson,
│   │                               SubtitleOverlay, CodeEditor, CodeRunner, sheets
│   └── pages/
│       ├── Login.tsx
│       ├── student/                Dashboard, Session, Lesson, Exam, Results, Progress, Questions
│       └── instructor/             Overview, Curriculum, Exams, Inbox, StudentRecord
├── IMPLEMENTATION_STATUS.md       honest feature-by-feature audit + known limits
├── .env.example                    every credential you must supply
└── scripts/verify-curriculum.mjs   structural checks on the curriculum
```

---

## 4. Implementation plan (the order this was built)

1. **Foundation** — confirm empty repo, choose stack, scaffold, DB schema, repository drivers, migrations + RLS, env contract.
2. **Identity** — two seeded accounts, bcrypt/Supabase Auth, httpOnly cookie, server-side roles, role-guarded routes, no signup, role-based redirect.
3. **Curriculum foundation** — 14 sessions, sequential unlock computed on the server (a URL cannot skip ahead), lessons with the 13-part structure, independent completion records.
4. **Student experience** — iOS/comic-green shell, dashboard, session cards, lesson reader, videos, subtitles, progress, questions, light/dark.
5. **Examinations** — question bank, variants, active-attempt state, timer, CodeMirror tasks, sandboxed run/test, server grading, 80% pass mark + practical threshold, abandon-on-back, next-session unlock.
6. **Integrations** — YouTube oEmbed/thumbnails/embeds, VTT upload + sync overlay + transcript, WhatsApp prefilled message saved before opening.
7. **Instructor console** — student overview, curriculum editor, exam editor/approvals, attempt resets, question inbox with replies and notifications.
8. **Verification** — typecheck, production build, API smoke tests against a seeded DB, browser preview, mobile-overflow review.

---

## 5. External configuration / credentials you must provide

Everything below is in `.env.example`. **Nothing is hard-coded in frontend code.**

| Setting | Who provides it | Why |
|---|---|---|
| `STUDENT_ACCOUNT_ID`, `STUDENT_PASSWORD` | You | Daniella's login. Choose a strong password. |
| `INSTRUCTOR_ACCOUNT_ID`, `INSTRUCTOR_PASSWORD` | You | Divine (Ace)'s login. Choose a strong password. |
| `AUTH_SECRET` | You | Signs the session cookie. ≥32 random characters. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | You (only for production mode) | Auth, Postgres, Storage. Service-role key stays server-side. |
| Supabase Auth users | You (once, in the Supabase dashboard) | Public sign-up must be disabled; create the two users manually and link their UIDs to `profiles.auth_user_id` (see `supabase/README.md`). |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Optional | Only needed if you later add direct client-side Supabase reads. The app currently proxies everything through the server. |
| YouTube Data API key | **Not required** | Metadata uses the public oEmbed endpoint; thumbnails are derived from the video ID. Duration is *not* returned by oEmbed, so the app never claims one. |
| WhatsApp number `+2348107543761` | Supplied in the brief | Used only to build `https://wa.me/2348107543761?text=...` after the question is persisted. |

**No service credentials were available in this build environment**, so the app boots in `local` mode with real SQLite records. It is fully testable with the seeded account IDs and passwords you set.

---

## 6. Running it

```bash
npm install
cp .env.example .env        # set the two passwords and AUTH_SECRET
npm run dev                 # http://localhost:5173 — one origin, one port
npm run typecheck
npm run build && npm start  # production: Express serves dist/
```

On first boot `server/seed.ts` creates `data/daniellacodes.db`, the two accounts, all sessions/lessons, verified video resources and the exam question bank. Seeding is idempotent: it never overwrites progress, attempts, instructor edits or replies.

### Verification

```bash
npm run typecheck           # client + server TypeScript
npm run check:curriculum    # 14 sessions / 66 lessons / 220 topics / 156 questions / 9 videos
npm run verify:api          # 63 end-to-end checks on a fresh temporary DB (both roles)
npm run verify:render       # headless React render of student + instructor pages
```

`verify:api` starts its **own** server on port `5199` with a throwaway SQLite file, so it never changes the academy you are running. `IMPLEMENTATION_STATUS.md` is the line-by-line honest audit of what works, what was verified and what is not claimed.

### Accounts
- `DANIELLACODES` → student → `/app`
- `ACECODES` → instructor → `/ace`

With no `.env`, the local development fallback passwords are `daniella-learns` and `ace-teaches`. These exist **only** so the self-contained preview is usable; they are not production credentials. Set `STUDENT_PASSWORD`, `INSTRUCTOR_PASSWORD` and `AUTH_SECRET` before deploying.

---

## 7. Honest limits

Read `IMPLEMENTATION_STATUS.md`. Short version: everything shipped is functional against real records; deliberately *not* claimed are (a) cheating being technologically impossible, (b) automatic detection of WhatsApp replies, (c) a hardened multi-tenant code-execution sandbox (the runner is isolated from the app/DB with timeouts, but a production deployment should use a dedicated, networkless micro-VM/Judge0-style service), and (d) instructor-supplied English subtitles for the nine preloaded videos — oEmbed provides no caption data, so those videos are explicitly marked **"Subtitles not supplied"** until ACECODES uploads and checks a `.vtt` file. No title, duration or subtitle text has been invented.

---

Created by Divine (Ace).
