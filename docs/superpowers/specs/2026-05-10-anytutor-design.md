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
| Deploy | Vercel (app) + Supabase (DB) + $12/mo VPS (Ollama) | |

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
/                       Landing page (hero, feature list, tier preview)
/auth/login             Login (email/password + Google)
/auth/signup            Signup
/dashboard              Topic list + "New Topic" button
/topics/new             Create topic — paste text or upload PDF
/topics/[id]            Topic detail — level selector (1–5, locked per tier)
/topics/[id]/[level]    Practice session
```

---

## Question Levels

| # | Japanese | English | Description |
|---|---|---|---|
| 1 | 基本 | Basic | Key concept recall |
| 2 | 易 | Easy | Apply the concept |
| 3 | 中 | Medium | Multi-step problems |
| 4 | 難 | Hard | Edge cases, complex reasoning |
| 5 | 鬼 | Olympic | Competition / research difficulty |

5 questions generated per level. Results cached in `question_sets` — AI only called once per topic+level combination.

---

## Practice Screen — Split Panel Layout

```
┌─────────────────────────────────────────────┐
│ Topic › Level          [progress dots]      │
├──────────────────────┬──────────────────────┤
│                      │                      │
│  QUESTION            │  Answer input        │
│  ─────────────────   │                      │
│  Solve: x²+5x+6=0   │  [Submit]            │
│                      │                      │
│  [progress dots]     │  💡 Hint panel       │
│                      │  (collapsed by def.) │
├──────────────────────┴──────────────────────┤
│  SCRATCHPAD — live KaTeX math editor        │
│  [math symbol palette: √ ∫ π sin cos →  ⇌]│
│  [chemistry palette: subscript superscript] │
└─────────────────────────────────────────────┘
```

**Scratchpad:** Uses `react-mathquill` for live LaTeX rendering. Symbol palette provides click-to-insert buttons for: √, ∫, ∂, π, Σ, sin, cos, tan, log, ln, →, ⇌, ±, ∞, subscript, superscript, fractions.

**Hint system:** Hints are progressive (Hint 1 = nudge, Hint 2 = more specific, Hint 3 = near-answer). Never reveals full solution. Each hint costs 1 from daily limit.

---

## Database Schema

```sql
users (
  id          uuid primary key,
  email       text unique not null,
  name        text,
  tier        text default 'free',  -- 'free' | 'plus' | 'ultra'
  hints_used_today  int default 0,
  hints_reset_at    timestamptz,
  created_at  timestamptz default now()
)

topics (
  id          uuid primary key,
  user_id     uuid references users(id) on delete cascade,
  name        text not null,
  content_text text,          -- pasted text content
  pdf_url     text,           -- Supabase Storage URL
  created_at  timestamptz default now()
)

question_sets (
  id          uuid primary key,
  topic_id    uuid references topics(id) on delete cascade,
  level       int not null check (level between 1 and 5),
  questions   jsonb not null,  -- array of {question, answer, explanation}
  generated_at timestamptz default now(),
  unique(topic_id, level)
)

sessions (
  id          uuid primary key,
  user_id     uuid references users(id),
  topic_id    uuid references topics(id),
  level       int not null,
  score       int,            -- number correct out of 5
  completed_at timestamptz
)

attempts (
  id              uuid primary key,
  session_id      uuid references sessions(id) on delete cascade,
  question_index  int not null,
  answer          text,
  correct         boolean,
  hints_used      int default 0
)
```

---

## PDF Parsing

PDFs uploaded to Supabase Storage. On upload, server extracts text using `pdf-parse` (Node.js). Extracted text stored in `topics.content_text`. Original PDF URL stored in `topics.pdf_url` for reference. If `pdf-parse` extracts empty text (scanned/image PDF), return error asking user to paste text manually instead.

---

## API Routes

```
POST /api/auth/...              NextAuth handlers
POST /api/topics                Create topic (text or PDF)
GET  /api/topics                List user's topics
GET  /api/topics/[id]           Get topic detail
POST /api/topics/[id]/generate  Generate questions for a level (cached)
POST /api/practice/grade        Grade an answer via Ollama
POST /api/practice/hint         Get next progressive hint via Ollama
```

---

## Ollama Prompt Strategy

**Question generation:** System prompt specifies level description, topic content, and output format (JSON array of 5 objects with `question`, `answer`, `explanation`).

**Grading:** Pass question + expected answer + student answer. Return `{correct: bool, feedback: string}`.

**Hints:** Pass question + attempt number (1–3). Return hint that nudges without revealing full answer.

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

- Payment processing (Stripe) — tier set manually
- Social features (leaderboards, sharing)
- Mobile app
- Offline mode
