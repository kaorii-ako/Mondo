import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isLevelAllowed, getModelForTier } from '@/lib/tier'
import { enqueueGeneration } from '@/lib/queue'
import { NextRequest, NextResponse } from 'next/server'

async function getOwnedTopic(userId: string, topicId: string) {
  const { data } = await supabaseAdmin
    .from('topics').select('id, content_text')
    .eq('id', topicId).eq('user_id', userId).is('deleted_at', null).single()
  return data
}

// POST — enqueue job
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { level, force } = await req.json() as { level: number; force?: boolean }

  if (!isLevelAllowed(session.user.tier, level)) {
    return NextResponse.json({ error: `Level ${level} requires a higher tier` }, { status: 403 })
  }

  const { id } = await params

  const topic = await getOwnedTopic(session.user.id, id)
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!topic.content_text) return NextResponse.json({ error: 'Topic has no content' }, { status: 400 })

  // Check cache unless force=true
  if (!force) {
    const { data: existing } = await supabaseAdmin
      .from('question_sets')
      .select('job_status, questions')
      .eq('topic_id', id).eq('level', level).single()

    if (existing?.job_status === 'done') {
      return NextResponse.json({ status: 'done', questions: existing.questions })
    }
    if (existing?.job_status === 'processing' || existing?.job_status === 'pending') {
      return NextResponse.json({ status: existing.job_status })
    }
  }

  const model = getModelForTier(session.user.tier)
  const jobId = await enqueueGeneration({
    topicId: id,
    level,
    topicContent: topic.content_text,
    model,
  })

  return NextResponse.json({ status: 'pending', jobId }, { status: 202 })
}

// GET — poll job status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const level = parseInt(req.nextUrl.searchParams.get('level') ?? '0', 10)
  const topic = await getOwnedTopic(session.user.id, id)
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data } = await supabaseAdmin
    .from('question_sets')
    .select('job_status, questions, job_error')
    .eq('topic_id', id).eq('level', level).single()

  if (!data) return NextResponse.json({ status: 'not_started' })
  return NextResponse.json({
    status:    data.job_status,
    questions: data.job_status === 'done' ? data.questions : undefined,
    error:     data.job_error ?? undefined,
  })
}
