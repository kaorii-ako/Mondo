import { describe, it, expect, vi } from 'vitest'

const mockAdmin = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../supabase-admin', () => ({ supabaseAdmin: mockAdmin }))

import { canUseHint, recordHint } from '../hints'

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

describe('recordHint', () => {
  it('inserts into hint_events', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    mockAdmin.from.mockReturnValue({ insert: insertMock })
    await recordHint('user-1')
    expect(mockAdmin.from).toHaveBeenCalledWith('hint_events')
    expect(insertMock).toHaveBeenCalledWith({ user_id: 'user-1' })
  })
})
