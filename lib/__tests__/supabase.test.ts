import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}))

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
  vi.resetModules()
})

it('exports supabaseBrowser, supabaseAdmin, supabaseAsUser', async () => {
  const mod = await import('../supabase')
  expect(mod.supabaseBrowser).toBeDefined()
  expect(mod.supabaseAdmin).toBeDefined()
  expect(typeof mod.supabaseAsUser).toBe('function')
})

it('supabaseAsUser returns a client when given a JWT', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const { supabaseAsUser } = await import('../supabase')
  supabaseAsUser('test-jwt')
  expect(createClient).toHaveBeenCalledWith(
    'https://test.supabase.co',
    'anon',
    expect.objectContaining({
      global: { headers: { Authorization: 'Bearer test-jwt' } },
    })
  )
})
