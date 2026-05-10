export type Tier = 'free' | 'plus' | 'ultra'

export type Level = 1 | 2 | 3 | 4 | 5

export interface MCQuestion {
  question: string
  options: [string, string, string, string]
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
