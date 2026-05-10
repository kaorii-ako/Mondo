# AnyTutor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build AnyTutor — a multi-user AI tutoring web app with 5-level question generation, live KaTeX/MathLive math scratchpad, and progressive hints.

**Architecture:** Next.js 14 App Router on Vercel for frontend + light API routes; Supabase for PostgreSQL + file storage; Ollama on a DigitalOcean VPS for AI inference; Upstash Redis + BullMQ worker on VPS for async question generation; NextAuth for JWT-based auth.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, NextAuth.js, Supabase JS, BullMQ, `@upstash/redis`, `pdf-parse`, MathLive, KaTeX, `bcryptjs`, vitest, @testing-library/react

---

## File Map

```
app/
  layout.tsx                         Root layout, fonts, theme
  page.tsx                           Landing page (static, no auth)
  globals.css
  auth/
    login/page.tsx                   Login form
    signup/page.tsx                  Signup form
  dashboard/page.tsx                 Topic list
  topics/
    new/page.tsx                     Create topic (text + PDF)
    [id]/page.tsx                    Topic detail, level selector
    [id]/[level]/page.tsx            Practice session

app/api/
  auth/[...nextauth]/route.ts        NextAuth handlers
  topics/
    route.ts                         GET list, POST create
    [id]/
      route.ts                       GET detail, DELETE (soft)
      generate/route.ts              POST enqueue job, GET poll status
  practice/
    grade/route.ts                   POST stream grade from Ollama
    hint/route.ts                    POST stream hint from Ollama (rate-limited)

lib/
  supabase.ts                        Supabase browser + admin clients
  auth.ts                            NextAuth config
  tier.ts                            Tier constants + limit helpers
  ollama.ts                          Ollama HTTP client + level prompts
  queue.ts                           BullMQ queue + Upstash Redis connection
  pdf.ts                             pdf-parse wrapper (size/page limits)
  hints.ts                           TOCTOU-safe hint count enforcement

workers/
  question-generator.ts              BullMQ worker: dequeue → Ollama → Supabase
  Dockerfile                         Docker image for VPS worker

components/
  ui/
    Button.tsx
    Toast.tsx
  topics/
    TopicCard.tsx
    TopicForm.tsx                    Text paste + PDF upload tabs
  practice/
    PracticeLayout.tsx               Split panel wrapper (responsive)
    QuestionPanel.tsx                KaTeX rendered question + progress dots
    AnswerPanel.tsx                  MC options (lv 1-2) or textarea (lv 3-5)
    HintPanel.tsx                    Collapsible, shows progressive hints
    Scratchpad.tsx                   MathLive editor + symbol palette
    ProgressDots.tsx

types/
  index.ts                           Shared TypeScript types

supabase/migrations/
  001_initial.sql                    Full schema + RLS

middleware.ts                        Protect /dashboard, /topics routes
tailwind.config.ts                   Wabi-Sabi palette
.env.local.example                   All env vars documented
docker-compose.yml                   Local dev: Ollama + Redis
```

---

## Task 1: Project Bootstrap + GitHub

**Files:**
- Create: `tailwind.config.ts` (modified from scaffold)
- Create: `app/layout.tsx`
- Create: `app/globals.css`
- Create: `types/index.ts`
- Create: `.env.local.example`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

- [ ] **Step 1: Scaffold project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

Answer prompts: TypeScript ✓, Tailwind ✓, ESLint ✓, App Router ✓, src/ dir ✗

- [ ] **Step 2: Install dependencies**

```bash
npm install next-auth@4 @auth/supabase-adapter @supabase/supabase-js \
  bullmq @upstash/redis pdf-parse mathlive katex bcryptjs \
  react-dropzone

npm install -D vitest @vitejs/plugin-react @testing-library/react \
  @testing-library/jest-dom jsdom @types/pdf-parse @types/katex \
  @types/bcryptjs
```

- [ ] **Step 3: Configure vitest**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

Create `vitest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:
```json
"test": "vitest",
"test:run": "vitest run"
```

- [ ] **Step 4: Configure Tailwind with Wabi-Sabi palette**

Replace `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wabi: {
          bg:      '#f5f0e8',
          surface: '#ede8df',
          border:  '#c9b99a',
          primary: '#8b7355',
          dark:    '#3d2e1e',
          muted:   '#7a6a55',
          light:   '#d4c5a9',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif JP"', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
}
export default config
```

- [ ] **Step 5: Root layout + globals**

Replace `app/layout.tsx`:
```typescript
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AnyTutor',
  description: 'AI-powered personal tutor for any subject',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-wabi-bg text-wabi-dark min-h-screen font-sans">
        {children}
      </body>
    </html>
  )
}
```

Replace `app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body { font-family: 'Inter', system-ui, sans-serif; }
h1, h2, h3 { font-family: 'Noto Serif JP', Georgia, serif; }
```

- [ ] **Step 6: Shared types**

Create `types/index.ts`:
```typescript
export type Tier = 'free' | 'plus' | 'ultra'

export type Level = 1 | 2 | 3 | 4 | 5

export interface MCQuestion {
  question: string
  options: [string, string, string, string]  // [A, B, C, D]
  answer: 'A' | 'B' | 'C' | 'D'
  explanation: string
}

export interface FreeQuestion {
  question: string
  answer: string
  explanation: string
}

export type Question = MCQuestion | FreeQuestion

export interface QuestionSet {
  id: string
  topic_id: string
  level: Level
  questions: Question[]
  job_status: 'pending' | 'processing' | 'done' | 'error'
  job_error: string | null
  generated_at: string
}

export interface Topic {
  id: string
  user_id: string
  name: string
  content_text: string | null
  pdf_url: string | null
  created_at: string
}

export interface UserProfile {
  id: string
  email: string
  name: string | null
  tier: Tier
}

export const LEVEL_LABELS: Record<Level, { ja: string; en: string; description: string }> = {
  1: { ja: '基本', en: 'Basic',   description: 'Key concept recall' },
  2: { ja: '易',   en: 'Easy',    description: 'Apply the concept' },
  3: { ja: '中',   en: 'Medium',  description: 'Multi-step problems' },
  4: { ja: '難',   en: 'Hard',    description: 'Edge cases, complex reasoning' },
  5: { ja: '鬼',   en: 'Olympic', description: 'Competition / research difficulty' },
}
```

- [ ] **Step 7: Create .env.local.example**

Create `.env.local.example`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=run: openssl rand -base64 32

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Ollama VPS
OLLAMA_BASE_URL=http://your-vps-ip:11434

# Upstash Redis (BullMQ)
UPSTASH_REDIS_REST_URL=https://your-upstash.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Worker concurrency (set on VPS)
OLLAMA_CONCURRENCY=2
```

Copy `.env.local.example` to `.env.local` and fill in values.

- [ ] **Step 8: Extend NextAuth session types**

Create `types/next-auth.d.ts`:
```typescript
import 'next-auth'
import { Tier } from './index'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      tier: Tier
    }
  }
  interface User {
    tier: Tier
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    tier: Tier
  }
}
```

- [ ] **Step 9: GitHub setup + first push**

```bash
git remote add origin https://github.com/YOUR_USERNAME/anytutor.git
git branch -M main
git add .
git commit -m "feat: bootstrap — Next.js 14, Wabi-Sabi theme, vitest, types"
git push -u origin main
```

---

## Task 2: Supabase Schema + RLS

**Files:**
- Create: `supabase/migrations/001_initial.sql`
- Create: `lib/supabase.ts`

- [ ] **Step 1: Write migration**

Create `supabase/migrations/001_initial.sql`:
```sql
create extension if not exists "pgcrypto";

create table users (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  name          text,
  password_hash text,
  tier          text default 'free' check (tier in ('free','plus','ultra')),
  created_at    timestamptz default now(),
  deleted_at    timestamptz
);

create table topics (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id) on delete cascade,
  name          text not null,
  content_text  text,
  pdf_url       text,
  created_at    timestamptz default now(),
  deleted_at    timestamptz
);

create table question_sets (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid references topics(id) on delete cascade,
  level         int not null check (level between 1 and 5),
  questions     jsonb not null default '[]',
  job_status    text default 'pending' check (job_status in ('pending','processing','done','error')),
  job_error     text,
  generated_at  timestamptz default now(),
  unique(topic_id, level)
);

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references users(id),
  topic_id      uuid references topics(id),
  level         int not null,
  score         int,
  started_at    timestamptz default now(),
  completed_at  timestamptz
);

create table attempts (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid references sessions(id) on delete cascade,
  question_index int not null,
  answer         text,
  correct        boolean,
  score          int,
  hints_used     int default 0
);

create table hint_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade,
  created_at timestamptz default now()
);

-- RLS
alter table users        enable row level security;
alter table topics       enable row level security;
alter table question_sets enable row level security;
alter table sessions     enable row level security;
alter table attempts     enable row level security;
alter table hint_events  enable row level security;

create policy users_self      on users        for all using (id = auth.uid());
create policy topics_owner    on topics       for all using (user_id = auth.uid() and deleted_at is null);
create policy qsets_owner     on question_sets for all using (
  topic_id in (select id from topics where user_id = auth.uid())
);
create policy sessions_owner  on sessions     for all using (user_id = auth.uid());
create policy attempts_owner  on attempts     for all using (
  session_id in (select id from sessions where user_id = auth.uid())
);
create policy hint_owner      on hint_events  for all using (user_id = auth.uid());

-- Storage bucket for PDFs
insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', false);

create policy pdf_upload on storage.objects for insert
  with check (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);

create policy pdf_read on storage.objects for select
  using (bucket_id = 'pdfs' and auth.uid()::text = (storage.foldername(name))[1]);
```

- [ ] **Step 2: Run migration**

Supabase Dashboard → SQL Editor → paste `001_initial.sql` → Run.

- [ ] **Step 3: Write Supabase client lib**

Create `lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseBrowser = createClient(url, anon)

export const supabaseAdmin = createClient(url, svc, {
  auth: { persistSession: false },
})

export function supabaseAsUser(jwt: string) {
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}
```

- [ ] **Step 4: Test client resolves**

Create `lib/__tests__/supabase.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}))

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
})

it('exports supabaseBrowser, supabaseAdmin, supabaseAsUser', async () => {
  const { supabaseBrowser, supabaseAdmin, supabaseAsUser } = await import('../supabase')
  expect(supabaseBrowser).toBeDefined()
  expect(supabaseAdmin).toBeDefined()
  expect(typeof supabaseAsUser).toBe('function')
})
```

Run: `npm run test:run lib/__tests__/supabase.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/ lib/supabase.ts lib/__tests__/
git commit -m "feat: Supabase schema, RLS policies, client lib"
```

---

## Task 3: Tier Constants + Auth

**Files:**
- Create: `lib/tier.ts`
- Create: `lib/auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `middleware.ts`

- [ ] **Step 1: Write failing tier tests**

Create `lib/__tests__/tier.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { getTierLimits, isLevelAllowed, isTopicLimitReached } from '../tier'

describe('getTierLimits', () => {
  it('free tier: 3 topics, max level 3, 5 hints', () => {
    const l = getTierLimits('free')
    expect(l).toEqual({ maxTopics: 3, maxLevel: 3, hintsPerDay: 5 })
  })
  it('plus tier: 20 topics, max level 5, 50 hints', () => {
    const l = getTierLimits('plus')
    expect(l).toEqual({ maxTopics: 20, maxLevel: 5, hintsPerDay: 50 })
  })
  it('ultra tier: unlimited topics, max level 5, unlimited hints', () => {
    const l = getTierLimits('ultra')
    expect(l).toEqual({ maxTopics: Infinity, maxLevel: 5, hintsPerDay: Infinity })
  })
})

describe('isLevelAllowed', () => {
  it('free can do level 3 but not 4', () => {
    expect(isLevelAllowed('free', 3)).toBe(true)
    expect(isLevelAllowed('free', 4)).toBe(false)
  })
  it('plus can do level 5', () => {
    expect(isLevelAllowed('plus', 5)).toBe(true)
  })
})

describe('isTopicLimitReached', () => {
  it('free at 3 topics is at limit', () => {
    expect(isTopicLimitReached('free', 3)).toBe(true)
    expect(isTopicLimitReached('free', 2)).toBe(false)
  })
  it('ultra never reaches limit', () => {
    expect(isTopicLimitReached('ultra', 9999)).toBe(false)
  })
})
```

Run: `npm run test:run lib/__tests__/tier.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 2: Implement tier lib**

Create `lib/tier.ts`:
```typescript
import type { Tier, Level } from '@/types'

interface TierLimits {
  maxTopics: number
  maxLevel: number
  hintsPerDay: number
}

export function getTierLimits(tier: Tier): TierLimits {
  switch (tier) {
    case 'free':  return { maxTopics: 3,        maxLevel: 3, hintsPerDay: 5 }
    case 'plus':  return { maxTopics: 20,        maxLevel: 5, hintsPerDay: 50 }
    case 'ultra': return { maxTopics: Infinity,  maxLevel: 5, hintsPerDay: Infinity }
  }
}

export function isLevelAllowed(tier: Tier, level: Level | number): boolean {
  return level <= getTierLimits(tier).maxLevel
}

export function isTopicLimitReached(tier: Tier, currentCount: number): boolean {
  return currentCount >= getTierLimits(tier).maxTopics
}

export function getModelForTier(tier: Tier): string {
  if (tier === 'free') return process.env.OLLAMA_MODEL_FREE  ?? 'qwen3.5:9b'
  return                      process.env.OLLAMA_MODEL_PRO   ?? 'qwen3.6:27b'
}
```

Run: `npm run test:run lib/__tests__/tier.test.ts`
Expected: PASS

- [ ] **Step 3: Write NextAuth config**

Create `lib/auth.ts`:
```typescript
import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from './supabase'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
        name:     { label: 'Name',     type: 'text' },
        mode:     { label: 'Mode',     type: 'text' }, // 'login' | 'signup'
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        if (credentials.mode === 'signup') {
          const { data: existing } = await supabaseAdmin
            .from('users').select('id').eq('email', credentials.email).maybeSingle()
          if (existing) throw new Error('Email already registered')

          const hash = await bcrypt.hash(credentials.password, 12)
          const { data: user, error } = await supabaseAdmin
            .from('users')
            .insert({ email: credentials.email, name: credentials.name || null, password_hash: hash })
            .select('id, email, name, tier').single()
          if (error || !user) throw new Error('Signup failed')
          return { id: user.id, email: user.email, name: user.name, tier: user.tier }
        }

        const { data: user } = await supabaseAdmin
          .from('users').select('id, email, name, tier, password_hash')
          .eq('email', credentials.email).single()
        if (!user?.password_hash) throw new Error('Invalid credentials')

        const valid = await bcrypt.compare(credentials.password, user.password_hash)
        if (!valid) throw new Error('Invalid credentials')
        return { id: user.id, email: user.email, name: user.name, tier: user.tier }
      },
    }),
    ...(process.env.GOOGLE_CLIENT_ID ? [
      GoogleProvider({
        clientId:     process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    ] : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        await supabaseAdmin.from('users').upsert(
          { email: user.email!, name: user.name ?? null },
          { onConflict: 'email', ignoreDuplicates: false }
        )
        const { data } = await supabaseAdmin
          .from('users').select('id, tier').eq('email', user.email!).single()
        if (data) { user.id = data.id; (user as any).tier = data.tier }
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) { token.id = user.id; token.tier = (user as any).tier ?? 'free' }
      return token
    },
    async session({ session, token }) {
      session.user.id   = token.id
      session.user.tier = token.tier
      return session
    },
  },
  pages: { signIn: '/auth/login', error: '/auth/login' },
  session: { strategy: 'jwt' },
}
```

- [ ] **Step 4: Create NextAuth route handler**

Create `app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 5: Create middleware**

Create `middleware.ts`:
```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/topics/:path*'],
}
```

- [ ] **Step 6: Login page**

Create `app/auth/login/page.tsx`:
```typescript
'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const res = await signIn('credentials', {
      email: fd.get('email'),
      password: fd.get('password'),
      mode: 'login',
      redirect: false,
    })
    setLoading(false)
    if (res?.error) { setError('Invalid email or password'); return }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-wabi-surface border border-wabi-border rounded-lg p-8">
        <h1 className="font-serif text-2xl text-wabi-dark mb-1">ようこそ</h1>
        <p className="text-wabi-muted text-sm mb-6">Sign in to AnyTutor</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="email" type="email" required placeholder="Email"
            className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary" />
          <input name="password" type="password" required placeholder="Password"
            className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary" />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-wabi-primary text-wabi-bg rounded py-2 text-sm hover:bg-wabi-dark transition-colors disabled:opacity-60">
            {loading ? '...' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-wabi-muted text-sm mt-4">
          No account? <a href="/auth/signup" className="text-wabi-primary underline">Sign up</a>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 7: Signup page**

Create `app/auth/signup/page.tsx`:
```typescript
'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const res = await signIn('credentials', {
      email: fd.get('email'),
      password: fd.get('password'),
      name: fd.get('name'),
      mode: 'signup',
      redirect: false,
    })
    setLoading(false)
    if (res?.error) { setError(res.error); return }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-wabi-surface border border-wabi-border rounded-lg p-8">
        <h1 className="font-serif text-2xl text-wabi-dark mb-1">はじめる</h1>
        <p className="text-wabi-muted text-sm mb-6">Create your account</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="name" type="text" placeholder="Name (optional)"
            className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary" />
          <input name="email" type="email" required placeholder="Email"
            className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary" />
          <input name="password" type="password" required placeholder="Password (min 8 chars)"
            minLength={8}
            className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary" />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-wabi-primary text-wabi-bg rounded py-2 text-sm hover:bg-wabi-dark transition-colors disabled:opacity-60">
            {loading ? '...' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-wabi-muted text-sm mt-4">
          Have an account? <a href="/auth/login" className="text-wabi-primary underline">Sign in</a>
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 8: Add SessionProvider wrapper**

Update `app/layout.tsx` to wrap with NextAuth SessionProvider:
```typescript
import type { Metadata } from 'next'
import { SessionProvider } from './session-provider'
import './globals.css'

export const metadata: Metadata = {
  title: 'AnyTutor',
  description: 'AI-powered personal tutor for any subject',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-wabi-bg text-wabi-dark min-h-screen font-sans">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
```

Create `app/session-provider.tsx`:
```typescript
'use client'
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
```

- [ ] **Step 9: Commit**

```bash
git add lib/tier.ts lib/auth.ts lib/__tests__/ app/api/auth/ app/auth/ middleware.ts app/session-provider.tsx types/
git commit -m "feat: auth (NextAuth credentials + Google), tier limits, middleware"
```

---

## Task 4: Topic CRUD API

**Files:**
- Create: `lib/pdf.ts`
- Create: `lib/__tests__/pdf.test.ts`
- Create: `app/api/topics/route.ts`
- Create: `app/api/topics/[id]/route.ts`

- [ ] **Step 1: Write failing PDF parser tests**

Create `lib/__tests__/pdf.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}))

describe('parsePdf', () => {
  it('returns extracted text', async () => {
    const { default: pdfParse } = await import('pdf-parse')
    vi.mocked(pdfParse).mockResolvedValueOnce({ text: 'hello world', numpages: 2 } as any)
    const { parsePdf } = await import('../pdf')
    const result = await parsePdf(Buffer.from('fake'))
    expect(result.text).toBe('hello world')
    expect(result.truncated).toBe(false)
  })

  it('truncates text exceeding 15000 chars and sets truncated=true', async () => {
    const { default: pdfParse } = await import('pdf-parse')
    vi.mocked(pdfParse).mockResolvedValueOnce({ text: 'a'.repeat(20000), numpages: 5 } as any)
    const { parsePdf } = await import('../pdf')
    const result = await parsePdf(Buffer.from('fake'))
    expect(result.text.length).toBe(15000)
    expect(result.truncated).toBe(true)
  })

  it('throws PdfEmptyError when text is empty', async () => {
    const { default: pdfParse } = await import('pdf-parse')
    vi.mocked(pdfParse).mockResolvedValueOnce({ text: '', numpages: 1 } as any)
    const { parsePdf, PdfEmptyError } = await import('../pdf')
    await expect(parsePdf(Buffer.from('fake'))).rejects.toThrow(PdfEmptyError)
  })
})
```

Run: `npm run test:run lib/__tests__/pdf.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement pdf.ts**

Create `lib/pdf.ts`:
```typescript
import pdfParse from 'pdf-parse'

const MAX_CHARS = 15_000

export class PdfEmptyError extends Error {
  constructor() { super('Could not extract text — please paste content manually') }
}

export class PdfEncryptedError extends Error {
  constructor() { super('Encrypted PDF — please paste text manually') }
}

export async function parsePdf(buffer: Buffer): Promise<{ text: string; truncated: boolean }> {
  let result: { text: string; numpages: number }
  try {
    result = await pdfParse(buffer)
  } catch (e: any) {
    if (e?.message?.includes('encrypted') || e?.message?.includes('password')) {
      throw new PdfEncryptedError()
    }
    throw e
  }

  const raw = result.text.trim()
  if (!raw) throw new PdfEmptyError()

  const truncated = raw.length > MAX_CHARS
  return { text: truncated ? raw.slice(0, MAX_CHARS) : raw, truncated }
}
```

Run: `npm run test:run lib/__tests__/pdf.test.ts`
Expected: PASS

- [ ] **Step 3: Topic list + create API**

Create `app/api/topics/route.ts`:
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isTopicLimitReached } from '@/lib/tier'
import { parsePdf, PdfEmptyError, PdfEncryptedError } from '@/lib/pdf'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('topics')
    .select('id, name, created_at, pdf_url')
    .eq('user_id', session.user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Enforce topic count limit
  const { count } = await supabaseAdmin
    .from('topics')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .is('deleted_at', null)

  if (isTopicLimitReached(session.user.tier, count ?? 0)) {
    return NextResponse.json(
      { error: `Topic limit reached for ${session.user.tier} tier` },
      { status: 403 }
    )
  }

  const contentType = req.headers.get('content-type') ?? ''
  let name: string
  let content_text: string | null = null
  let pdf_url: string | null = null
  let truncated = false

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    name = form.get('name') as string
    const text = form.get('text') as string | null
    const file = form.get('pdf') as File | null

    if (file) {
      // Validate size (10 MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'PDF too large (max 10 MB)' }, { status: 422 })
      }
      if (file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'Only PDF files accepted' }, { status: 422 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      try {
        const parsed = await parsePdf(buffer)
        content_text = parsed.text
        truncated = parsed.truncated
      } catch (e) {
        if (e instanceof PdfEmptyError || e instanceof PdfEncryptedError) {
          return NextResponse.json({ error: (e as Error).message }, { status: 422 })
        }
        throw e
      }

      // Upload to Supabase Storage
      const path = `${session.user.id}/${Date.now()}-${file.name}`
      const { data: upload, error: uploadErr } = await supabaseAdmin.storage
        .from('pdfs').upload(path, buffer, { contentType: 'application/pdf' })
      if (uploadErr) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      pdf_url = upload.path
    } else if (text) {
      content_text = text
    }
  } else {
    const body = await req.json()
    name = body.name
    content_text = body.text ?? null
  }

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!content_text) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('topics')
    .insert({ user_id: session.user.id, name, content_text, pdf_url })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, truncated }, { status: 201 })
}
```

- [ ] **Step 4: Topic detail + soft-delete API**

Create `app/api/topics/[id]/route.ts`:
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

async function getOwnedTopic(userId: string, topicId: string) {
  const { data } = await supabaseAdmin
    .from('topics').select()
    .eq('id', topicId).eq('user_id', userId).is('deleted_at', null).single()
  return data
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const topic = await getOwnedTopic(session.user.id, params.id)
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(topic)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const topic = await getOwnedTopic(session.user.id, params.id)
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabaseAdmin.from('topics')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', params.id)

  return new NextResponse(null, { status: 204 })
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/pdf.ts lib/__tests__/pdf.test.ts app/api/topics/
git commit -m "feat: topic CRUD API with PDF parsing, tier enforcement, soft-delete"
```

---

## Task 5: Ollama Client + BullMQ Queue

**Files:**
- Create: `lib/ollama.ts`
- Create: `lib/__tests__/ollama.test.ts`
- Create: `lib/queue.ts`
- Create: `workers/question-generator.ts`
- Create: `docker-compose.yml`

- [ ] **Step 1: Write failing Ollama prompt tests**

Create `lib/__tests__/ollama.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildGenerationPrompt } from '../ollama'

describe('buildGenerationPrompt', () => {
  it('level 1-2 prompt contains "multiple choice" and "options"', () => {
    const p = buildGenerationPrompt('Photosynthesis basics', 1)
    expect(p.system).toContain('multiple choice')
    expect(p.system).toContain('"options"')
  })

  it('level 3-5 prompt does not contain "options" key', () => {
    const p = buildGenerationPrompt('Photosynthesis basics', 3)
    expect(p.system).not.toContain('"options"')
    expect(p.system).toContain('"answer"')
  })

  it('prompt includes topic content', () => {
    const p = buildGenerationPrompt('Topic content here', 2)
    expect(p.user).toContain('Topic content here')
  })
})
```

Run: `npm run test:run lib/__tests__/ollama.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement ollama.ts**

Create `lib/ollama.ts`:
```typescript
const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

interface Prompt { system: string; user: string }

export function buildGenerationPrompt(topicContent: string, level: number): Prompt {
  const isMC = level <= 2

  const levelDesc: Record<number, string> = {
    1: 'basic key-concept recall',
    2: 'applying the concept in a straightforward scenario',
    3: 'multi-step reasoning requiring multiple concepts',
    4: 'hard edge cases and complex problem-solving',
    5: 'Olympic/competition difficulty — research level',
  }

  const system = isMC
    ? `You are an expert tutor. Generate exactly 5 multiple choice questions at difficulty: ${levelDesc[level]}.
Return ONLY a JSON array with no markdown. Each element must have:
{"question": string, "options": [string, string, string, string], "answer": "A"|"B"|"C"|"D", "explanation": string}
The answer letter must correspond to the correct option in the "options" array (index 0=A, 1=B, 2=C, 3=D).`
    : `You are an expert tutor. Generate exactly 5 free-response questions at difficulty: ${levelDesc[level]}.
Return ONLY a JSON array with no markdown. Each element must have:
{"question": string, "answer": string, "explanation": string}`

  const user = `Topic content:\n\n${topicContent}\n\nGenerate 5 questions now.`
  return { system, user }
}

export function buildGradePrompt(question: string, modelAnswer: string, studentAnswer: string): Prompt {
  return {
    system: `You are a fair and encouraging tutor grading a student's answer.
Return ONLY JSON: {"score": number 0-100, "feedback": string, "reasoning": string}
score 90-100: essentially correct, score 60-89: partially correct with gaps, score 0-59: incorrect or missing key points.
Never reveal the full model answer. feedback should guide the student.`,
    user: `Question: ${question}\nModel answer: ${modelAnswer}\nStudent answer: ${studentAnswer}`,
  }
}

export function buildHintPrompt(question: string, hintNumber: number): Prompt {
  const depth = ['a very gentle nudge pointing to the right approach (do NOT reveal the answer)',
                 'a more specific hint about the method to use (do NOT give the answer)',
                 'a near-answer hint — describe what the answer looks like without stating it'][hintNumber - 1]
  return {
    system: `You are a tutor giving hint ${hintNumber}/3. Give ${depth}. Be concise (2-3 sentences max).`,
    user: `Question: ${question}`,
  }
}

export async function ollamaGenerate(
  model: string,
  prompt: Prompt,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user',   content: prompt.user },
      ],
      stream: false,
    }),
    signal,
  })
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
  const data = await res.json()
  return data.message?.content ?? ''
}

export async function* ollamaStream(
  model: string,
  prompt: Prompt,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user',   content: prompt.user },
      ],
      stream: true,
    }),
    signal,
  })
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)

  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = dec.decode(value).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        if (obj.message?.content) yield obj.message.content
      } catch {}
    }
  }
}
```

Run: `npm run test:run lib/__tests__/ollama.test.ts`
Expected: PASS

- [ ] **Step 3: Set up BullMQ queue**

Create `lib/queue.ts`:
```typescript
import { Queue } from 'bullmq'
import { Redis } from '@upstash/redis'

const connection = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export const questionQueue = new Queue('question-generation', { connection })

export interface GenerationJobData {
  topicId:      string
  level:        number
  topicContent: string
  model:        string
}

export async function enqueueGeneration(data: GenerationJobData) {
  const job = await questionQueue.add('generate', data, {
    attempts:  3,
    backoff:   { type: 'exponential', delay: 5000 },
    timeout:   120_000,
  })
  return job.id
}
```

- [ ] **Step 4: Write BullMQ worker**

Create `workers/question-generator.ts`:
```typescript
import { Worker } from 'bullmq'
import { Redis } from '@upstash/redis'
import { createClient } from '@supabase/supabase-js'
import { buildGenerationPrompt, ollamaGenerate } from '../lib/ollama'
import type { GenerationJobData } from '../lib/queue'

const connection = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const concurrency = parseInt(process.env.OLLAMA_CONCURRENCY ?? '2', 10)

const worker = new Worker<GenerationJobData>(
  'question-generation',
  async (job) => {
    const { topicId, level, topicContent, model } = job.data

    // Mark as processing
    await supabase.from('question_sets')
      .upsert({ topic_id: topicId, level, questions: [], job_status: 'processing' },
               { onConflict: 'topic_id,level' })

    const prompt = buildGenerationPrompt(topicContent, level)
    const raw = await ollamaGenerate(model, prompt)

    let questions: unknown[]
    try {
      // Strip markdown code fences if present
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      questions = JSON.parse(cleaned)
      if (!Array.isArray(questions)) throw new Error('Not an array')
    } catch {
      throw new Error(`Failed to parse Ollama response: ${raw.slice(0, 200)}`)
    }

    await supabase.from('question_sets')
      .upsert(
        { topic_id: topicId, level, questions, job_status: 'done', generated_at: new Date().toISOString() },
        { onConflict: 'topic_id,level' }
      )
  },
  { connection, concurrency }
)

worker.on('failed', async (job, err) => {
  if (!job) return
  const { topicId, level } = job.data
  await supabase.from('question_sets')
    .upsert(
      { topic_id: topicId, level, questions: [], job_status: 'error', job_error: err.message },
      { onConflict: 'topic_id,level' }
    )
})

console.log(`Question generation worker started (concurrency=${concurrency})`)
```

- [ ] **Step 5: Local dev docker-compose**

Create `docker-compose.yml`:
```yaml
version: '3.9'
services:
  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_NUM_PARALLEL=2

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  ollama_data:
```

Run locally: `docker compose up -d` then `ollama pull qwen3.5:9b`

- [ ] **Step 6: Commit**

```bash
git add lib/ollama.ts lib/__tests__/ollama.test.ts lib/queue.ts workers/ docker-compose.yml
git commit -m "feat: Ollama client (prompts, stream, grade), BullMQ queue, worker"
```

---

## Task 6: Question Generation API

**Files:**
- Create: `app/api/topics/[id]/generate/route.ts`

- [ ] **Step 1: Write generate + poll route**

Create `app/api/topics/[id]/generate/route.ts`:
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isLevelAllowed, getModelForTier } from '@/lib/tier'
import { enqueueGeneration } from '@/lib/queue'
import { NextRequest, NextResponse } from 'next/server'

async function getOwnedTopic(userId: string, topicId: string) {
  const { data } = await supabaseAdmin
    .from('topics').select('id, content_text')
    .eq('id', topicId).eq('user_id', userId).is('deleted_at', null).single()
  return data
}

// POST /api/topics/[id]/generate — enqueue job
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { level, force } = await req.json() as { level: number; force?: boolean }

  if (!isLevelAllowed(session.user.tier, level)) {
    return NextResponse.json(
      { error: `Level ${level} requires a higher tier` },
      { status: 403 }
    )
  }

  const topic = await getOwnedTopic(session.user.id, params.id)
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!topic.content_text) return NextResponse.json({ error: 'Topic has no content' }, { status: 400 })

  // Check cache unless force=true
  if (!force) {
    const { data: existing } = await supabaseAdmin
      .from('question_sets')
      .select('job_status, questions')
      .eq('topic_id', params.id).eq('level', level).single()

    if (existing?.job_status === 'done') {
      return NextResponse.json({ status: 'done', questions: existing.questions })
    }
    if (existing?.job_status === 'processing' || existing?.job_status === 'pending') {
      return NextResponse.json({ status: existing.job_status })
    }
  }

  const model = getModelForTier(session.user.tier)
  const jobId = await enqueueGeneration({
    topicId: params.id,
    level,
    topicContent: topic.content_text,
    model,
  })

  return NextResponse.json({ status: 'pending', jobId }, { status: 202 })
}

// GET /api/topics/[id]/generate?level=N — poll job status
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const level = parseInt(req.nextUrl.searchParams.get('level') ?? '0', 10)
  const topic = await getOwnedTopic(session.user.id, params.id)
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data } = await supabaseAdmin
    .from('question_sets')
    .select('job_status, questions, job_error')
    .eq('topic_id', params.id).eq('level', level).single()

  if (!data) return NextResponse.json({ status: 'not_started' })
  return NextResponse.json({
    status:    data.job_status,
    questions: data.job_status === 'done' ? data.questions : undefined,
    error:     data.job_error ?? undefined,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/topics/
git commit -m "feat: question generation API (enqueue + poll)"
```

---

## Task 7: Hint System (TOCTOU-safe)

**Files:**
- Create: `lib/hints.ts`
- Create: `lib/__tests__/hints.test.ts`
- Create: `app/api/practice/hint/route.ts`

- [ ] **Step 1: Write failing hint limit tests**

Create `lib/__tests__/hints.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest'
import { canUseHint, recordHint } from '../hints'

const mockAdmin = {
  from: vi.fn(),
}
vi.mock('../supabase', () => ({ supabaseAdmin: mockAdmin }))

describe('canUseHint', () => {
  it('returns true when user has remaining hints', async () => {
    mockAdmin.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count: 2, error: null }),
        }),
      }),
    })
    const result = await canUseHint('user-1', 5)
    expect(result).toBe(true)
  })

  it('returns false when at daily limit', async () => {
    mockAdmin.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          gte: () => Promise.resolve({ count: 5, error: null }),
        }),
      }),
    })
    const result = await canUseHint('user-1', 5)
    expect(result).toBe(false)
  })

  it('returns true when limit is Infinity (ultra tier)', async () => {
    const result = await canUseHint('user-1', Infinity)
    expect(result).toBe(true)
  })
})
```

Run: `npm run test:run lib/__tests__/hints.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement hints.ts**

Create `lib/hints.ts`:
```typescript
import { supabaseAdmin } from './supabase'

export async function canUseHint(userId: string, dailyLimit: number): Promise<boolean> {
  if (dailyLimit === Infinity) return true

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { count, error } = await supabaseAdmin
    .from('hint_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', startOfDay.toISOString())

  if (error) throw error
  return (count ?? 0) < dailyLimit
}

export async function recordHint(userId: string): Promise<void> {
  await supabaseAdmin.from('hint_events').insert({ user_id: userId })
}
```

Run: `npm run test:run lib/__tests__/hints.test.ts`
Expected: PASS

- [ ] **Step 3: Hint API route (streaming)**

Create `app/api/practice/hint/route.ts`:
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTierLimits } from '@/lib/tier'
import { canUseHint, recordHint } from '@/lib/hints'
import { buildHintPrompt, ollamaStream } from '@/lib/ollama'
import { getModelForTier } from '@/lib/tier'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question, hintNumber } = await req.json() as {
    question: string
    hintNumber: 1 | 2 | 3
  }

  const { hintsPerDay } = getTierLimits(session.user.tier)
  const allowed = await canUseHint(session.user.id, hintsPerDay)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Daily hint limit reached' },
      { status: 429 }
    )
  }

  // Record hint before streaming (prevents double-spend from concurrent requests)
  await recordHint(session.user.id)

  const model = getModelForTier(session.user.tier)
  const prompt = buildHintPrompt(question, hintNumber)

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of ollamaStream(model, prompt)) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 4: Grade API route (streaming)**

Create `app/api/practice/grade/route.ts`:
```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildGradePrompt, ollamaStream } from '@/lib/ollama'
import { getModelForTier } from '@/lib/tier'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question, modelAnswer, studentAnswer } = await req.json() as {
    question:      string
    modelAnswer:   string
    studentAnswer: string
  }

  const model = getModelForTier(session.user.tier)
  const prompt = buildGradePrompt(question, modelAnswer, studentAnswer)

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of ollamaStream(model, prompt)) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/hints.ts lib/__tests__/hints.test.ts app/api/practice/
git commit -m "feat: hint system (TOCTOU-safe), grade + hint streaming API routes"
```

---

## Task 8: UI — Shared Components

**Files:**
- Create: `components/ui/Button.tsx`
- Create: `components/ui/Toast.tsx`
- Create: `components/practice/ProgressDots.tsx`

- [ ] **Step 1: Button component**

Create `components/ui/Button.tsx`:
```typescript
import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const base = 'rounded transition-colors disabled:opacity-60 font-sans'
  const variants = {
    primary: 'bg-wabi-primary text-wabi-bg hover:bg-wabi-dark',
    ghost:   'bg-wabi-surface text-wabi-primary border border-wabi-border hover:bg-wabi-light',
  }
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' }
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />
}
```

- [ ] **Step 2: Toast component**

Create `components/ui/Toast.tsx`:
```typescript
'use client'
import { useEffect, useState } from 'react'

export function Toast({ message, type = 'info', onDismiss }: {
  message: string
  type?: 'info' | 'error' | 'success'
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const colors = {
    info:    'bg-wabi-surface border-wabi-border text-wabi-dark',
    error:   'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  }

  return (
    <div className={`fixed bottom-6 right-6 border rounded-lg px-4 py-3 text-sm shadow-md z-50 max-w-sm ${colors[type]}`}>
      {message}
    </div>
  )
}
```

- [ ] **Step 3: ProgressDots component + test**

Create `components/practice/__tests__/ProgressDots.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { ProgressDots } from '../ProgressDots'

it('renders correct number of dots', () => {
  render(<ProgressDots total={5} current={2} />)
  const dots = screen.getAllByTestId('progress-dot')
  expect(dots).toHaveLength(5)
})

it('marks dots before current as completed', () => {
  render(<ProgressDots total={5} current={2} />)
  const dots = screen.getAllByTestId('progress-dot')
  expect(dots[0]).toHaveAttribute('data-state', 'done')
  expect(dots[1]).toHaveAttribute('data-state', 'done')
  expect(dots[2]).toHaveAttribute('data-state', 'current')
  expect(dots[3]).toHaveAttribute('data-state', 'pending')
})
```

Run: `npm run test:run components/practice/__tests__/ProgressDots.test.tsx`
Expected: FAIL

Create `components/practice/ProgressDots.tsx`:
```typescript
export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }, (_, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'pending'
        return (
          <div
            key={i}
            data-testid="progress-dot"
            data-state={state}
            className={`rounded-full transition-all ${
              state === 'done'    ? 'w-2.5 h-2.5 bg-wabi-primary' :
              state === 'current' ? 'w-3 h-3 border-2 border-wabi-primary bg-wabi-bg' :
                                   'w-2.5 h-2.5 bg-wabi-light'
            }`}
          />
        )
      })}
    </div>
  )
}
```

Run: `npm run test:run components/practice/__tests__/ProgressDots.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add components/
git commit -m "feat: shared UI components (Button, Toast, ProgressDots)"
```

---

## Task 9: Dashboard + Topic Form UI

**Files:**
- Create: `components/topics/TopicCard.tsx`
- Create: `components/topics/TopicForm.tsx`
- Create: `app/dashboard/page.tsx`
- Create: `app/topics/new/page.tsx`

- [ ] **Step 1: TopicCard component**

Create `components/topics/TopicCard.tsx`:
```typescript
import { Topic } from '@/types'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export function TopicCard({ topic, onDelete }: { topic: Topic; onDelete: (id: string) => void }) {
  return (
    <div className="bg-wabi-surface border border-wabi-border rounded-lg p-5 flex items-start justify-between group">
      <div>
        <Link href={`/topics/${topic.id}`} className="font-serif text-lg text-wabi-dark hover:text-wabi-primary transition-colors">
          {topic.name}
        </Link>
        <p className="text-wabi-muted text-xs mt-1">
          {new Date(topic.created_at).toLocaleDateString()}
          {topic.pdf_url && ' · PDF'}
        </p>
      </div>
      <Button
        variant="ghost" size="sm"
        onClick={() => onDelete(topic.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        削除
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Dashboard page**

Create `app/dashboard/page.tsx`:
```typescript
'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { TopicCard } from '@/components/topics/TopicCard'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import type { Topic } from '@/types'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  useEffect(() => {
    fetch('/api/topics').then(r => r.json()).then(setTopics).finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    await fetch(`/api/topics/${id}`, { method: 'DELETE' })
    setTopics(t => t.filter(x => x.id !== id))
    setToast({ message: 'Topic deleted', type: 'success' })
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-wabi-dark">学習</h1>
          <p className="text-wabi-muted text-sm mt-1">
            {session?.user.name ?? session?.user.email} · {session?.user.tier}
          </p>
        </div>
        <Link href="/topics/new">
          <Button>＋ New Topic</Button>
        </Link>
      </div>

      {loading && <p className="text-wabi-muted text-sm">Loading...</p>}

      {!loading && topics.length === 0 && (
        <div className="text-center py-16 text-wabi-muted">
          <p className="font-serif text-xl mb-2">まだ何もない</p>
          <p className="text-sm">No topics yet — create your first one</p>
        </div>
      )}

      <div className="space-y-3">
        {topics.map(t => <TopicCard key={t.id} topic={t} onDelete={handleDelete} />)}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </main>
  )
}
```

- [ ] **Step 3: TopicForm component**

Create `components/topics/TopicForm.tsx`:
```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

type Tab = 'text' | 'pdf'

export function TopicForm() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('text')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let res: Response
      if (tab === 'pdf' && file) {
        const fd = new FormData()
        fd.append('name', name)
        fd.append('pdf', file)
        res = await fetch('/api/topics', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, text }),
        })
      }

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      if (data.truncated) alert('PDF was truncated to first ~15,000 characters')
      router.push(`/topics/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs tracking-widest text-wabi-muted uppercase mb-1">Topic Name</label>
        <input
          value={name} onChange={e => setName(e.target.value)} required
          placeholder="e.g. Quadratic Equations"
          className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary"
        />
      </div>

      <div>
        <div className="flex border-b border-wabi-border mb-4">
          {(['text', 'pdf'] as Tab[]).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm transition-colors ${tab === t ? 'border-b-2 border-wabi-primary text-wabi-primary' : 'text-wabi-muted'}`}>
              {t === 'text' ? 'Paste Text' : 'Upload PDF'}
            </button>
          ))}
        </div>

        {tab === 'text' ? (
          <textarea
            value={text} onChange={e => setText(e.target.value)} required
            placeholder="Paste your topic content, notes, or textbook excerpt here..."
            rows={8}
            className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary resize-y"
          />
        ) : (
          <div
            onClick={() => document.getElementById('pdf-input')?.click()}
            className="border-2 border-dashed border-wabi-border rounded-lg p-10 text-center cursor-pointer hover:border-wabi-primary transition-colors"
          >
            <input id="pdf-input" type="file" accept="application/pdf" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <p className="text-wabi-dark text-sm">{file.name}</p>
            ) : (
              <p className="text-wabi-muted text-sm">Click to upload PDF (max 10 MB)</p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Creating...' : 'Create Topic →'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: New Topic page**

Create `app/topics/new/page.tsx`:
```typescript
import { TopicForm } from '@/components/topics/TopicForm'
import Link from 'next/link'

export default function NewTopicPage() {
  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <Link href="/dashboard" className="text-wabi-muted text-sm hover:text-wabi-primary">← 戻る</Link>
      <h1 className="font-serif text-3xl text-wabi-dark mt-4 mb-8">新しいトピック</h1>
      <TopicForm />
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/ app/topics/new/ components/topics/
git commit -m "feat: dashboard, topic form (text + PDF upload), topic card"
```

---

## Task 10: Topic Detail + Level Selector

**Files:**
- Create: `app/topics/[id]/page.tsx`

- [ ] **Step 1: Topic detail page with level cards**

Create `app/topics/[id]/page.tsx`:
```typescript
'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { LEVEL_LABELS, type Level, type Topic } from '@/types'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

const LEVELS: Level[] = [1, 2, 3, 4, 5]

const TIER_MAX: Record<string, number> = { free: 3, plus: 5, ultra: 5 }

export default function TopicDetailPage() {
  const { data: session } = useSession()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [generating, setGenerating] = useState<Level | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/topics/${params.id}`).then(r => r.json()).then(setTopic)
  }, [params.id])

  const maxLevel = TIER_MAX[session?.user.tier ?? 'free']

  async function startLevel(level: Level) {
    setGenerating(level)
    setError('')
    const res = await fetch(`/api/topics/${params.id}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error); setGenerating(null); return }
    if (data.status === 'done') { router.push(`/topics/${params.id}/${level}`); return }

    // Poll until done
    const poll = setInterval(async () => {
      const r = await fetch(`/api/topics/${params.id}/generate?level=${level}`)
      const d = await r.json()
      if (d.status === 'done') { clearInterval(poll); router.push(`/topics/${params.id}/${level}`) }
      if (d.status === 'error') { clearInterval(poll); setError(d.error ?? 'Generation failed'); setGenerating(null) }
    }, 2000)
  }

  if (!topic) return <div className="text-center py-20 text-wabi-muted">Loading...</div>

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <Link href="/dashboard" className="text-wabi-muted text-sm hover:text-wabi-primary">← 戻る</Link>
      <h1 className="font-serif text-3xl text-wabi-dark mt-4 mb-2">{topic.name}</h1>
      <p className="text-wabi-muted text-sm mb-8">Choose a difficulty level to practice</p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="space-y-3">
        {LEVELS.map(level => {
          const label = LEVEL_LABELS[level]
          const locked = level > maxLevel
          const busy   = generating === level

          return (
            <div key={level}
              className={`border rounded-lg p-5 flex items-center justify-between transition-colors ${
                locked ? 'border-wabi-light bg-wabi-light/30 opacity-60' : 'border-wabi-border bg-wabi-surface hover:border-wabi-primary'
              }`}
            >
              <div>
                <span className="font-serif text-xl text-wabi-primary mr-3">{label.ja}</span>
                <span className="text-wabi-dark font-medium text-sm">{label.en}</span>
                <p className="text-wabi-muted text-xs mt-0.5">{label.description}</p>
              </div>
              {locked ? (
                <span className="text-xs text-wabi-muted border border-wabi-border rounded px-2 py-1">
                  Upgrade
                </span>
              ) : (
                <Button size="sm" onClick={() => startLevel(level)} disabled={generating !== null}>
                  {busy ? '生成中...' : '開始'}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/topics/
git commit -m "feat: topic detail page with level selector, generation polling, tier locks"
```

---

## Task 11: Practice Session — Core Layout + Question Panel

**Files:**
- Create: `components/practice/PracticeLayout.tsx`
- Create: `components/practice/QuestionPanel.tsx`
- Create: `app/topics/[id]/[level]/page.tsx`

- [ ] **Step 1: Install KaTeX CSS**

Add to `app/globals.css`:
```css
@import 'katex/dist/katex.min.css';
```

- [ ] **Step 2: PracticeLayout — split panel**

Create `components/practice/PracticeLayout.tsx`:
```typescript
export function PracticeLayout({ left, right, bottom }: {
  left:   React.ReactNode
  right:  React.ReactNode
  bottom: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-wabi-bg flex flex-col">
      {/* Split panels */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 border-b border-wabi-border">
        {/* Left: Question */}
        <div className="flex-1 p-6 md:p-8 border-b md:border-b-0 md:border-r border-wabi-border overflow-y-auto">
          {left}
        </div>
        {/* Right: Answer + Hint */}
        <div className="flex-1 p-6 md:p-8 flex flex-col gap-4 overflow-y-auto">
          {right}
        </div>
      </div>
      {/* Bottom: Scratchpad */}
      <div className="border-t border-wabi-border">
        {bottom}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: QuestionPanel**

Create `components/practice/QuestionPanel.tsx`:
```typescript
'use client'
import { useEffect, useRef } from 'react'
import katex from 'katex'
import { ProgressDots } from './ProgressDots'
import type { Level } from '@/types'
import { LEVEL_LABELS } from '@/types'

function renderLatex(text: string): string {
  return text.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => {
    try { return katex.renderToString(m, { displayMode: true, throwOnError: false }) } catch { return m }
  }).replace(/\$([^$]+?)\$/g, (_, m) => {
    try { return katex.renderToString(m, { displayMode: false, throwOnError: false }) } catch { return m }
  })
}

export function QuestionPanel({ question, level, current, total }: {
  question: string
  level:    Level
  current:  number
  total:    number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = renderLatex(question)
  }, [question])

  const label = LEVEL_LABELS[level]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="font-serif text-2xl text-wabi-primary">{label.ja}</span>
          <span className="text-xs tracking-widest text-wabi-muted uppercase">{label.en}</span>
        </div>
        <ProgressDots total={total} current={current} />
      </div>

      <div className="flex-1">
        <p className="text-xs tracking-widest text-wabi-muted uppercase mb-3">Question {current + 1}</p>
        <div
          ref={ref}
          className="text-wabi-dark text-base leading-relaxed border-l-2 border-wabi-primary pl-4"
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create stub components** (prevents compile errors; replaced in Tasks 12–14)

Create `components/practice/AnswerPanel.tsx`:
```typescript
export function AnswerPanel(_: { question: any; isMC: boolean; topicId: string; onNext: () => void }) {
  return <div className="text-wabi-muted text-sm p-4">Answer panel loading...</div>
}
```

Create `components/practice/HintPanel.tsx`:
```typescript
export function HintPanel(_: { question: string }) {
  return <div className="border border-dashed border-wabi-border rounded-lg px-4 py-3 text-wabi-muted text-sm">Hints loading...</div>
}
```

Create `components/practice/Scratchpad.tsx`:
```typescript
export function Scratchpad() {
  return <div className="px-5 py-4 text-wabi-muted text-sm">Scratchpad loading...</div>
}
```

- [ ] **Step 5: Practice session page scaffold**

Create `app/topics/[id]/[level]/page.tsx`:
```typescript
'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PracticeLayout } from '@/components/practice/PracticeLayout'
import { QuestionPanel } from '@/components/practice/QuestionPanel'
import { AnswerPanel } from '@/components/practice/AnswerPanel'
import { HintPanel } from '@/components/practice/HintPanel'
import { Scratchpad } from '@/components/practice/Scratchpad'
import type { Question, Level, QuestionSet } from '@/types'
import Link from 'next/link'

export default function PracticePage() {
  const params = useParams<{ id: string; level: string }>()
  const level = parseInt(params.level, 10) as Level
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/topics/${params.id}/generate?level=${level}`)
      .then(r => r.json())
      .then((data: Partial<QuestionSet>) => {
        if (data.job_status === 'done' && data.questions) {
          setQuestions(data.questions)
        } else {
          setError('Questions not ready — go back and try again')
        }
      })
      .finally(() => setLoading(false))
  }, [params.id, level])

  if (loading) return <div className="flex items-center justify-center min-h-screen text-wabi-muted">Loading...</div>
  if (error)   return <div className="flex items-center justify-center min-h-screen text-red-600">{error}</div>
  if (!questions.length) return null

  const q = questions[current]
  const isMC = 'options' in q

  return (
    <PracticeLayout
      left={
        <QuestionPanel
          question={q.question}
          level={level}
          current={current}
          total={questions.length}
        />
      }
      right={
        <div className="flex flex-col gap-4 h-full">
          <AnswerPanel
            question={q}
            isMC={isMC}
            topicId={params.id}
            onNext={() => setCurrent(c => Math.min(c + 1, questions.length - 1))}
          />
          <HintPanel question={q.question} topicId={params.id} />
        </div>
      }
      bottom={<Scratchpad />}
    />
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add app/topics/ components/practice/PracticeLayout.tsx components/practice/QuestionPanel.tsx components/practice/AnswerPanel.tsx components/practice/HintPanel.tsx components/practice/Scratchpad.tsx
git commit -m "feat: practice session page, split panel layout, KaTeX question rendering, component stubs"
```

---

## Task 12: Answer Panel (MC + Free Text + Grading)

**Files:**
- Create: `components/practice/AnswerPanel.tsx`

- [ ] **Step 1: AnswerPanel component**

Create `components/practice/AnswerPanel.tsx`:
```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { Question, MCQuestion } from '@/types'

type GradeResult = { score: number; feedback: string; reasoning: string }

interface AnswerPanelProps {
  question: Question
  isMC:     boolean
  topicId:  string
  onNext:   () => void
}

export function AnswerPanel({ question, isMC, onNext }: AnswerPanelProps) {
  const [selected, setSelected] = useState<string>('')
  const [freeText, setFreeText] = useState('')
  const [result, setResult] = useState<{ correct?: boolean; grade?: GradeResult } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    if (isMC) {
      const mc = question as MCQuestion
      const correct = selected === mc.answer
      setResult({ correct })
      setLoading(false)
      return
    }

    // Free text — stream grade from Ollama
    const res = await fetch('/api/practice/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question:      question.question,
        modelAnswer:   question.answer,
        studentAnswer: freeText,
      }),
    })

    if (res.status === 503) {
      setResult({ grade: { score: 0, feedback: 'Server busy — try again in a moment', reasoning: '' } })
      setLoading(false)
      return
    }

    let raw = ''
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      raw += dec.decode(value)
    }
    try {
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const grade = JSON.parse(cleaned) as GradeResult
      setResult({ grade })
    } catch {
      setResult({ grade: { score: 0, feedback: 'Could not parse grade — try again', reasoning: '' } })
    }
    setLoading(false)
  }

  const OPTION_LABELS = ['A', 'B', 'C', 'D']

  return (
    <div className="flex flex-col gap-3 flex-1">
      <p className="text-xs tracking-widest text-wabi-muted uppercase">Your Answer</p>

      {isMC ? (
        <div className="space-y-2">
          {(question as MCQuestion).options.map((opt, i) => {
            const letter = OPTION_LABELS[i]
            const isSelected = selected === letter
            const mc = question as MCQuestion
            const showResult = result !== null
            const correct = letter === mc.answer
            let cls = 'border rounded-lg px-4 py-3 text-sm cursor-pointer transition-colors w-full text-left flex items-start gap-3 '
            if (showResult) {
              cls += correct ? 'border-green-400 bg-green-50 text-green-800 ' : isSelected ? 'border-red-300 bg-red-50 text-red-800 ' : 'border-wabi-border text-wabi-muted '
            } else {
              cls += isSelected ? 'border-wabi-primary bg-wabi-surface text-wabi-dark ' : 'border-wabi-border hover:border-wabi-primary text-wabi-dark '
            }
            return (
              <button key={letter} className={cls} onClick={() => !result && setSelected(letter)}>
                <span className="font-serif font-bold text-wabi-primary w-4 shrink-0">{letter}</span>
                <span>{opt}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <textarea
          value={freeText}
          onChange={e => setFreeText(e.target.value)}
          disabled={result !== null}
          placeholder="Write your answer here..."
          rows={5}
          className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary resize-none"
        />
      )}

      {result && (
        <div className={`rounded-lg p-4 text-sm ${
          result.correct === true || (result.grade && result.grade.score >= 60)
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {isMC ? (
            <>
              <p className="font-medium">{result.correct ? '正解 · Correct!' : '不正解 · Incorrect'}</p>
              <p className="mt-1 text-xs">{(question as MCQuestion).explanation}</p>
            </>
          ) : result.grade ? (
            <>
              <p className="font-medium">Score: {result.grade.score}/100</p>
              <p className="mt-1">{result.grade.feedback}</p>
            </>
          ) : null}
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        {!result ? (
          <Button onClick={handleSubmit} disabled={loading || (!isMC && !freeText) || (isMC && !selected)} className="flex-1">
            {loading ? '採点中...' : '答える · Submit'}
          </Button>
        ) : (
          <Button onClick={() => { setResult(null); setSelected(''); setFreeText(''); onNext() }} className="flex-1">
            次へ · Next →
          </Button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/practice/AnswerPanel.tsx
git commit -m "feat: answer panel (MC auto-grade, free-text LLM grade with streaming)"
```

---

## Task 13: Hint Panel

**Files:**
- Create: `components/practice/HintPanel.tsx`

- [ ] **Step 1: HintPanel component**

Create `components/practice/HintPanel.tsx`:
```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function HintPanel({ question }: { question: string }) {
  const [hints, setHints]       = useState<string[]>([])
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [limitHit, setLimitHit] = useState(false)

  const nextHintNum = hints.length + 1
  const canGetHint  = nextHintNum <= 3 && !loading && !limitHit

  async function getHint() {
    setLoading(true)
    setExpanded(true)
    const res = await fetch('/api/practice/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, hintNumber: nextHintNum }),
    })

    if (res.status === 429) { setLimitHit(true); setLoading(false); return }
    if (res.status === 503) { setLoading(false); return }

    let text = ''
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    setHints(h => [...h, ''])
    const idx = hints.length
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += dec.decode(value)
      setHints(h => h.map((x, i) => i === idx ? text : x))
    }
    setLoading(false)
  }

  return (
    <div className="border border-dashed border-wabi-border rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm text-wabi-muted hover:text-wabi-primary transition-colors"
      >
        <span>💡 ヒント · Hints {hints.length > 0 && `(${hints.length}/3 used)`}</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {hints.map((h, i) => (
            <div key={i} className="text-sm text-wabi-dark border-l-2 border-wabi-light pl-3">
              <span className="text-xs text-wabi-muted uppercase tracking-widest">Hint {i + 1}</span>
              <p className="mt-1">{h}</p>
            </div>
          ))}

          {limitHit && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">Daily hint limit reached</p>
          )}

          {canGetHint && (
            <Button variant="ghost" size="sm" onClick={getHint} disabled={loading}>
              {loading ? '考え中...' : `Get Hint ${nextHintNum}`}
            </Button>
          )}

          {hints.length === 3 && !limitHit && (
            <p className="text-xs text-wabi-muted">All hints used. Try solving it yourself!</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/practice/HintPanel.tsx
git commit -m "feat: hint panel (progressive 3 hints, streaming, daily limit UI)"
```

---

## Task 14: MathLive Scratchpad

**Files:**
- Create: `components/practice/Scratchpad.tsx`

- [ ] **Step 1: Scratchpad component**

Create `components/practice/Scratchpad.tsx`:
```typescript
'use client'
import { useEffect, useRef, useState } from 'react'

const MATH_SYMBOLS = [
  { label: '√', latex: '\\sqrt{}' },
  { label: '∫', latex: '\\int' },
  { label: 'π', latex: '\\pi' },
  { label: 'Σ', latex: '\\sum' },
  { label: '∂', latex: '\\partial' },
  { label: '∞', latex: '\\infty' },
  { label: '±', latex: '\\pm' },
  { label: 'sin', latex: '\\sin()' },
  { label: 'cos', latex: '\\cos()' },
  { label: 'tan', latex: '\\tan()' },
  { label: 'log', latex: '\\log' },
  { label: 'ln',  latex: '\\ln' },
  { label: 'x²',  latex: '^{2}' },
  { label: 'xₙ',  latex: '_{}' },
  { label: 'a/b', latex: '\\frac{}{}' },
]

const CHEM_SYMBOLS = [
  { label: '→',  latex: '\\rightarrow' },
  { label: '⇌',  latex: '\\rightleftharpoons' },
  { label: 'H₂', latex: 'H_{2}' },
  { label: 'O₂', latex: 'O_{2}' },
  { label: 'CO₂', latex: 'CO_{2}' },
  { label: '°C',  latex: '^{\\circ}C' },
]

export function Scratchpad() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mfRef        = useRef<any>(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!containerRef.current || !open) return
    import('mathlive').then(({ MathfieldElement }) => {
      if (mfRef.current) return
      const mf = new MathfieldElement()
      mf.style.cssText = 'width:100%;min-height:60px;font-size:1.1rem;border:none;outline:none;background:transparent;'
      mf.setAttribute('placeholder', 'Type math here — use keyboard or click symbols above...')
      containerRef.current!.appendChild(mf)
      mfRef.current = mf
    })
  }, [open])

  function insertSymbol(latex: string) {
    mfRef.current?.executeCommand(['insert', latex])
    mfRef.current?.focus()
  }

  function clear() {
    if (mfRef.current) mfRef.current.value = ''
  }

  return (
    <div className="bg-wabi-surface">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-xs tracking-widest text-wabi-muted uppercase hover:text-wabi-primary transition-colors"
      >
        <span>✎ Scratchpad</span>
        <span>{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          {/* Symbol palettes */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {MATH_SYMBOLS.map(s => (
              <button key={s.label}
                type="button"
                onClick={() => insertSymbol(s.latex)}
                className="px-2.5 py-1 text-xs bg-wabi-bg border border-wabi-border rounded hover:border-wabi-primary hover:text-wabi-primary transition-colors font-mono"
              >
                {s.label}
              </button>
            ))}
            <span className="w-px h-5 self-center bg-wabi-border mx-1" />
            {CHEM_SYMBOLS.map(s => (
              <button key={s.label}
                type="button"
                onClick={() => insertSymbol(s.latex)}
                className="px-2.5 py-1 text-xs bg-wabi-bg border border-wabi-border rounded hover:border-wabi-primary hover:text-wabi-primary transition-colors font-mono"
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              onClick={clear}
              className="ml-auto px-2.5 py-1 text-xs text-wabi-muted hover:text-red-600 transition-colors"
            >
              Clear
            </button>
          </div>

          {/* MathLive editor */}
          <div
            ref={containerRef}
            className="bg-wabi-bg border border-wabi-border rounded-lg px-4 py-3 min-h-[64px]"
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/practice/Scratchpad.tsx
git commit -m "feat: MathLive scratchpad with math + chemistry symbol palette"
```

---

## Task 15: Landing Page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Landing page**

Replace `app/page.tsx`:
```typescript
import Link from 'next/link'

const FEATURES = [
  { ja: '問題生成', en: 'AI Question Generation',    desc: '5 levels from basic recall to Olympic difficulty' },
  { ja: '数式入力', en: 'Live Math Editor',           desc: 'MathLive scratchpad with full LaTeX and chemistry symbols' },
  { ja: 'ヒント',  en: 'Progressive Hints',          desc: 'Up to 3 hints per question — nudges, not answers' },
  { ja: '全教科',  en: 'Any Subject',                 desc: 'Upload a PDF or paste text — works for any topic' },
]

const TIERS = [
  { name: 'Free',  ja: '無料', topics: '3', levels: '1–3', hints: '5/day',  model: 'Standard' },
  { name: 'Plus',  ja: 'プラス', topics: '20', levels: '1–5', hints: '50/day', model: 'Pro' },
  { name: 'Ultra', ja: '超',    topics: '∞',  levels: '1–5', hints: '∞',       model: 'Pro' },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-wabi-border">
        <span className="font-serif text-xl text-wabi-dark tracking-wide">AnyTutor</span>
        <div className="flex gap-3">
          <Link href="/auth/login"  className="text-sm text-wabi-muted hover:text-wabi-primary transition-colors">Sign in</Link>
          <Link href="/auth/signup" className="text-sm bg-wabi-primary text-wabi-bg px-4 py-1.5 rounded hover:bg-wabi-dark transition-colors">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-2xl mx-auto text-center px-6 py-24">
        <p className="text-wabi-muted tracking-widest text-xs uppercase mb-4">個人AI家庭教師</p>
        <h1 className="font-serif text-5xl text-wabi-dark leading-tight mb-6">
          Your personal<br />AI tutor
        </h1>
        <p className="text-wabi-muted text-lg mb-10">
          Upload any topic — get 5 levels of practice questions,<br />
          live math editing, and smart hints.
        </p>
        <Link href="/auth/signup"
          className="inline-block bg-wabi-primary text-wabi-bg px-8 py-3 rounded-lg text-sm hover:bg-wabi-dark transition-colors">
          Start for free →
        </Link>
      </section>

      {/* Features */}
      <section className="max-w-2xl mx-auto px-6 pb-20 grid grid-cols-2 gap-4">
        {FEATURES.map(f => (
          <div key={f.ja} className="bg-wabi-surface border border-wabi-border rounded-lg p-5">
            <p className="font-serif text-wabi-primary text-xl mb-1">{f.ja}</p>
            <p className="text-wabi-dark font-medium text-sm">{f.en}</p>
            <p className="text-wabi-muted text-xs mt-1">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Tier table */}
      <section className="max-w-xl mx-auto px-6 pb-24">
        <h2 className="font-serif text-2xl text-center text-wabi-dark mb-8">料金プラン</h2>
        <div className="border border-wabi-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-wabi-border bg-wabi-surface">
                <th className="text-left px-4 py-3 text-wabi-muted font-normal"></th>
                {TIERS.map(t => (
                  <th key={t.name} className="px-4 py-3 text-center text-wabi-dark font-serif">
                    <div className="text-lg text-wabi-primary">{t.ja}</div>
                    <div className="text-xs text-wabi-muted font-normal">{t.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Topics',    key: 'topics' },
                { label: 'Levels',    key: 'levels' },
                { label: 'Hints',     key: 'hints' },
                { label: 'AI Model',  key: 'model' },
              ].map(row => (
                <tr key={row.label} className="border-b border-wabi-border last:border-0">
                  <td className="px-4 py-3 text-wabi-muted">{row.label}</td>
                  {TIERS.map(t => (
                    <td key={t.name} className="px-4 py-3 text-center text-wabi-dark">
                      {(t as any)[row.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Commit and push**

```bash
git add app/page.tsx
git commit -m "feat: landing page with hero, features, tier comparison"
git push origin main
```

---

## Task 16: Final Checks + Worker Dockerfile

**Files:**
- Create: `workers/Dockerfile`
- Create: `.gitignore` additions

- [ ] **Step 1: Worker Dockerfile for VPS**

Create `workers/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY lib/ollama.ts lib/queue.ts lib/
COPY workers/question-generator.ts workers/
COPY tsconfig.json .
RUN npx tsc --outDir dist
CMD ["node", "dist/workers/question-generator.js"]
```

- [ ] **Step 2: Update .gitignore**

Add to `.gitignore`:
```
.env.local
.superpowers/
dist/
```

- [ ] **Step 3: Run full test suite**

```bash
npm run test:run
```

Expected: All tests pass.

- [ ] **Step 4: VPS setup instructions (README addition)**

Add `VPS_SETUP.md`:
```markdown
# VPS Setup (DigitalOcean)

1. Create $12/mo droplet (2 vCPU, 4 GB RAM), Ubuntu 22.04
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Install Ollama: `curl -fsSL https://ollama.com/install.sh | sh`
4. Pull models:
   ```
   ollama pull qwen3.5:9b
   ollama pull qwen3.6:27b
   ```
5. Set env vars in `/etc/environment`:
   ```
   UPSTASH_REDIS_REST_URL=...
   UPSTASH_REDIS_REST_TOKEN=...
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_CONCURRENCY=2
   ```
6. Run worker:
   ```
   docker build -f workers/Dockerfile -t anytutor-worker .
   docker run -d --restart always --env-file /etc/environment anytutor-worker
   ```
7. Expose Ollama (for Vercel API routes to reach it):
   - Set `OLLAMA_HOST=0.0.0.0` in Ollama systemd service
   - Add firewall rule: allow port 11434 from Vercel IP ranges only
```

- [ ] **Step 5: Final push**

```bash
git add workers/Dockerfile VPS_SETUP.md .gitignore
git commit -m "feat: worker Dockerfile, VPS setup guide, gitignore"
git push origin main
```

---

## Vercel Deploy Checklist

After pushing to GitHub:

1. Go to vercel.com → Import project → select `anytutor` repo
2. Set environment variables (from `.env.local.example`) in Vercel dashboard
3. Add `NEXTAUTH_URL=https://your-app.vercel.app`
4. Deploy — Vercel auto-detects Next.js
5. Test: visit `/` → sign up → create topic → generate questions → practice
