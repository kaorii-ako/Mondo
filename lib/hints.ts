import { supabaseAdmin } from './supabase-admin'

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
