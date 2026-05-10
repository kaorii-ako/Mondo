import { describe, it, expect } from 'vitest'
import { getTierLimits, isLevelAllowed, isTopicLimitReached, getModelForTier } from '../tier'

describe('getTierLimits', () => {
  it('free tier: 3 topics, max level 3, 5 hints', () => {
    expect(getTierLimits('free')).toEqual({ maxTopics: 3, maxLevel: 3, hintsPerDay: 5 })
  })
  it('plus tier: 20 topics, max level 5, 50 hints', () => {
    expect(getTierLimits('plus')).toEqual({ maxTopics: 20, maxLevel: 5, hintsPerDay: 50 })
  })
  it('ultra tier: unlimited topics, max level 5, unlimited hints', () => {
    expect(getTierLimits('ultra')).toEqual({ maxTopics: Infinity, maxLevel: 5, hintsPerDay: Infinity })
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

describe('getModelForTier', () => {
  it('free uses OLLAMA_MODEL_FREE env var', () => {
    process.env.OLLAMA_MODEL_FREE = 'qwen3.5:9b'
    expect(getModelForTier('free')).toBe('qwen3.5:9b')
  })
  it('plus/ultra use OLLAMA_MODEL_PRO env var', () => {
    process.env.OLLAMA_MODEL_PRO = 'qwen3.6:27b'
    expect(getModelForTier('plus')).toBe('qwen3.6:27b')
    expect(getModelForTier('ultra')).toBe('qwen3.6:27b')
  })
})
