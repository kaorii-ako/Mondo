import 'server-only'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabaseAdmin = createClient(url, svc, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export function supabaseAsUser(jwt: string) {
  return createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
}
