import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTierLimits, getModelForTier } from '@/lib/tier'
import { canUseHint, recordHint } from '@/lib/hints'
import { buildHintPrompt, ollamaStream } from '@/lib/ollama'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question, hintNumber } = await req.json() as {
    question: string
    hintNumber: 1 | 2 | 3
  }

  if (!question || typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ error: 'question required' }, { status: 400 })
  }
  if (![1, 2, 3].includes(hintNumber)) {
    return NextResponse.json({ error: 'hintNumber must be 1, 2, or 3' }, { status: 400 })
  }

  const { hintsPerDay } = getTierLimits(session.user.tier)
  const allowed = await canUseHint(session.user.id, hintsPerDay)
  if (!allowed) {
    return NextResponse.json({ error: 'Daily hint limit reached' }, { status: 429 })
  }

  // Record before streaming — prevents double-spend from concurrent requests
  await recordHint(session.user.id)

  const model = getModelForTier(session.user.tier)
  const prompt = buildHintPrompt(question, hintNumber)

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of ollamaStream(model, prompt)) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })

  return new NextResponse(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
