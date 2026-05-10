# AnyTutor — Design Spec
_Date: 2026-05-10_

## Overview

Multi-user AI tutoring web app. Users upload topics (text or PDF) and exam questions; the AI generates practice questions at 5 difficulty levels, grades answers, and provides progressive hints. Japanese Wabi-Sabi aesthetic. Tiered access (free / plus / ultra).

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 App Router + TypeScript | Full-stack, easy Vercel deploy |
| Styling | Tailwind CSS (Wabi-Sabi palette) | Utility-first, custom theme |
| Auth | NextAuth.js | Email/password + Google OAuth |
| Database | Supabase (PostgreSQL) | Free tier, real-time, row-level security |
| File storage | Supabase Storage | PDF uploads |
| AI | Ollama on DigitalOcean VPS | Free inference, self-hosted |
| Job queue | BullMQ + Redis | Ollama concurrency management |
| Deploy | Vercel (app) + Supabase (DB) + $12/mo VPS (Ollama + Redis) | |

---

## AI Models

| Tier | Model |
|---|---|
| Free | `qwen3.5:9b` |
| Plus / Ultra | `qwen3.6:27b` |

Model selection enforced server-side per `user.tier`. Ollama URL stored in env var `OLLAMA_BASE_URL`.

---

## Tiers

| Feature | Free | Plus | Ultra |
|---|---|---|---|
| Topics | 3 | 20 | Unlimited |
| Max difficulty level | 3 | 5 | 5 |
| Hints / day | 5 | 50 | Unlimited |
| AI model | qwen3.5:9b | qwen3.6:27b | qwen3.6:27b |

Tier stored on `users.tier`. All limits enforced in API routes, never just client-side. Payments are out of scope for v1 — tier can be set manually in DB.

---

## Pages & Routes

```
/                       Landing page — static, no auth required (hero, features, tier preview)
/auth/login             Login (email/password + Google)
/auth/signup            Signup
/dashboard              Topic list + "New Topic" button
/topics/new             Create topic — paste text or upload PDF
/topics/[id]            Topic detail — level selector (1–5, locked per tier)
/topics/[id]/[level]    Practice session
```

---

## Question Levels & Answer Format

| # | Japanese | English | Description | Answer format |
|---|---|---|---|---|
| 1 | 基本 | Basic | Key concept recall | Multiple choice (4 options) |
| 2 | 易 | Easy | Apply the concept | Multiple choice (4 options) |
| 3 | 中 | Medium | Multi-step problems | Free text |
| 4 | 難 | Hard | Edge cases, complex reasoning | Free text |
| 5 | 鬼 | Olympic | Competition / research difficulty | Free text |

Levels 1–2 use multiple choice — consistent grading, no LLM subjectivity. Levels 3–5 use free text — graded by LLM returning `{score: 0-100, feedback: string, reasoning: string}` (not binary correct/incorrect).

5 questions generated per level. Results cached in `question_sets` — AI only called once per topic+level combination unless `?force=true` is passed (re-roll).

---

## Practice Screen — Split Panel Layout

```
┌─────────────────────────────────────────────┐
│ Topic › Level          [progress dots]      │
├──────────────────────┬──────────────────────┤
│                      │                      │
│  QUESTION            │  Answer input        │
│  (KaTeX rendered)    │  (MC options or      │
│                      │   free text)         │
│  Solve: x²+5x+6=0   │  [Submit]            │
│                      │                      │
│  [progress dots]     │  💡 Hint panel       │
│                      │  (collapsed by def.) │
├──────────────────────┴──────────────────────┤
│  SCRATCHPAD — MathLive live math editor     │
│  [math palette: √ ∫ π sin cos → ⇌ ± ∞]    │
│  [chem palette: subscript superscript → ⇌] │
└─────────────────────────────────────────────┘
```

**Responsive:** Below 900px, panels stack vertically (question top, answer middle, scratchpad bottom). Scratchpad collapses to a toggle at ≤640px. Mobile is not a primary target for v1 but must not be completely broken.

**Math rendering:** Questions containing LaTeX are rendered with **KaTeX** (display only). The scratchpad uses **MathLive** (`mathlive` npm package — actively maintained, replaces unmaintained react-mathquill) for live interactive editing. Symbol palette provides click-to-insert for: √, ∫, ∂, π, Σ, sin, cos, tan, log, ln, →, ⇌, ±, ∞, subscript, superscript, fractions.

**Hint system:** Hints are progressive (Hint 1 = nudge, Hint 2 = more specific, Hint 3 = near-answer). Never reveals full solution. Each hint costs 1 from daily limit. Limit enforced via `hint_events` table (see schema).

**AI response streaming:** `/api/topics/[id]/generate` and `/api/practice/grade` stream responses via `ReadableStream`. Devs must not implement as blocking calls — UX will be unusable on slow Ollama inference.

---

## Ollama Concurrency

Ollama on a single VPS cannot handle parallel requests without queuing. All Ollama calls go through a **BullMQ** job queue backed by Redis (co-located on the VPS). Workers process jobs sequentially (or up to N concurrent based on VPS RAM). If the queue is full or job times out, API returns `503` with a `Retry-After` header. The UI shows a "Server busy — try again in a moment" toast, not a silent failure.

Queue config:
- `concurrency`: 2 (adjustable via env var `OLLAMA_CONCURRENCY`)
- `jobTimeout`: 120s
- `maxQueueSize`: 20 (reject beyond this)

---

## Database Schema

```sql
users (
  id                uuid primary key default gen_random_uuid(),
  email             text unique not null,
  name              text,                          -- nullable (email/password signup may not have it)
  tier              text default 'free' check (tier in ('free','plus','ultra')),
  created_at        timestamptz default now(),
  deleted_at        timestamptz                    -- soft delete
)

topics (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references users(id) on delete cascade,
  name              text not null,
  content_text      text,                          -- extracted from PDF or pasted
  pdf_url           text,                          -- Supabase Storage URL
  created_at        timestamptz default now(),
  deleted_at        timestamptz                    -- soft delete, allows recovery
)

question_sets (
  id                uuid primary key default gen_random_uuid(),
  topic_id          uuid references topics(id) on delete cascade,
  level             int not null check (level between 1 and 5),
  questions         jsonb not null,                -- [{question, answer, explanation, options?}]
  generated_at      timestamptz default now(),
  unique(topic_id, level)                          -- INSERT ... ON CONFLICT DO UPDATE for re-roll
)

sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references users(id),
  topic_id          uuid references topics(id),
  level             int not null,
  score             int,                           -- correct answers out of 5
  started_at        timestamptz default now(),
  completed_at      timestamptz
)

attempts (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid references sessions(id) on delete cascade,
  question_index    int not null,
  answer            text,
  correct           boolean,
  score             int,                           -- 0-100 for free-text levels
  hints_used        int default 0
)

hint_events (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references users(id) on delete cascade,
  created_at        timestamptz default now()
)
-- Hint limit enforced by: SELECT COUNT(*) FROM hint_events WHERE user_id = $1
--   AND created_at > date_trunc('day', now())
-- Run inside BEGIN ... FOR UPDATE on the users row to prevent TOCTOU.
-- No cron needed — lazy reset via date_trunc comparison on each request.
```

---

## Row-Level Security (RLS) Policies

All tables have RLS enabled. Policies:

```sql
-- users: own row only
CREATE POLICY users_self ON users USING (id = auth.uid());

-- topics: owner only (excludes soft-deleted)
CREATE POLICY topics_owner ON topics
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- question_sets: readable if user owns the topic
CREATE POLICY qsets_owner ON question_sets
  USING (topic_id IN (SELECT id FROM topics WHERE user_id = auth.uid()));

-- sessions + attempts: user-scoped
CREATE POLICY sessions_owner ON sessions USING (user_id = auth.uid());
CREATE POLICY attempts_owner ON attempts
  USING (session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid()));

-- hint_events: user-scoped
CREATE POLICY hint_events_owner ON hint_events USING (user_id = auth.uid());
```

---

## API Routes

```
POST /api/auth/...                    NextAuth handlers
POST /api/topics                      Create topic — enforces topic count limit per tier before insert
GET  /api/topics                      List user's non-deleted topics
GET  /api/topics/[id]                 Get topic detail
DELETE /api/topics/[id]               Soft-delete (sets deleted_at)
POST /api/topics/[id]/generate        Generate questions for a level (cached; ?force=true to re-roll)
                                      — enforces level limit per tier before queuing Ollama job
                                      — streams response
POST /api/practice/grade              Grade answer via Ollama — streams response
POST /api/practice/hint               Get next progressive hint — enforces daily hint limit (TOCTOU-safe)
```

**Tier enforcement locations:**
- `POST /api/topics` — count non-deleted topics before inserting; return `403` if at limit
- `POST /api/topics/[id]/generate` — check `level <= tier_max_level` before queuing; return `403` if over tier
- `POST /api/practice/hint` — count today's `hint_events` inside transaction; return `429` if at limit

---

## PDF Parsing & Validation

**Validation (before upload):**
- Max file size: 10 MB (enforced client-side + server-side)
- Accepted MIME type: `application/pdf` only
- Encrypted PDFs: `pdf-parse` throws on encrypted files — catch and return `422` with message "Encrypted PDF — please paste text manually"

**Parsing:**
- Upload PDF to Supabase Storage
- Extract text with `pdf-parse` (Node.js)
- Truncate to first ~15,000 tokens (~20 pages) with a warning if truncated
- Store extracted text in `topics.content_text`
- If extracted text is empty (scanned/image PDF): return `422` with message "Could not extract text — please paste content manually"

---

## Ollama Prompt Strategy

**Question generation (levels 1–2 — multiple choice):**
System prompt: level description + topic content + instruction to output JSON array of 5 objects: `{question, options: [A,B,C,D], answer: "A"|"B"|"C"|"D", explanation}`.

**Question generation (levels 3–5 — free text):**
System prompt: level description + topic content + instruction to output JSON array of 5 objects: `{question, answer, explanation}`.

**Grading (levels 3–5):**
Pass: question + model answer + student answer. Return `{score: 0-100, feedback: string, reasoning: string}`.

**Hints:**
Pass: question + hint number (1–3). Return hint that nudges without revealing full answer. Hint 1 = direction, Hint 2 = method, Hint 3 = near-answer.

---

## Visual Design — Wabi-Sabi Warm

```
Background:   #f5f0e8  (warm paper)
Surface:      #ede8df  (card/panel bg)
Border:       #c9b99a  (subtle dividers)
Primary:      #8b7355  (ink brown — buttons, accents)
Text dark:    #3d2e1e  (headings)
Text muted:   #7a6a55  (secondary text)
Accent light: #d4c5a9  (hover states)
```

Typography: `Noto Serif JP` (headings) + `Inter` (body). Japanese kanji used decoratively for level labels and UI accents.

---

## Out of Scope (v1)

- Payment processing (Stripe) — tier set manually in DB
- Social features (leaderboards, sharing)
- Mobile app
- Offline mode
- Scanned PDF OCR (image-based PDFs return an error)
