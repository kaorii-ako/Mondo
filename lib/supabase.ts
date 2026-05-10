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
