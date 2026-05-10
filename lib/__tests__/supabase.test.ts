import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}))

vi.mock('server-only', () => ({}))

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
  vi.resetModules()
})

it('supabaseBrowser is exported from lib/supabase', async () => {
  const mod = await import('../supabase')
  expect(mod.supabaseBrowser).toBeDefined()
})

it('supabaseAdmin and supabaseAsUser are exported from lib/supabase-admin', async () => {
  const mod = await import('../supabase-admin')
  expect(mod.supabaseAdmin).toBeDefined()
  expect(typeof mod.supabaseAsUser).toBe('function')
})

it('supabaseAsUser passes Authorization header', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const { supabaseAsUser } = await import('../supabase-admin')
  supabaseAsUser('my-jwt')
  expect(createClient).toHaveBeenCalledWith(
    'https://test.supabase.co',
    'anon',
    expect.objectContaining({
      global: { headers: { Authorization: 'Bearer my-jwt' } },
    })
  )
})
