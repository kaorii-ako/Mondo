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
  if (tier === 'free') return process.env.OLLAMA_MODEL_FREE ?? 'qwen3.5:9b'
  return                      process.env.OLLAMA_MODEL_PRO  ?? 'qwen3.6:27b'
}
