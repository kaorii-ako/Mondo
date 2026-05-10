import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

async function getOwnedTopic(userId: string, topicId: string) {
  const { data } = await supabaseAdmin
    .from('topics').select()
    .eq('id', topicId).eq('user_id', userId).is('deleted_at', null).single()
  return data
}

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const topic = await getOwnedTopic(session.user.id, id)
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(topic)
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const topic = await getOwnedTopic(session.user.id, id)
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabaseAdmin.from('topics')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)

  return new NextResponse(null, { status: 204 })
}
