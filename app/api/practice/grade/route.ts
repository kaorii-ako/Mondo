import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { buildGradePrompt, ollamaStream } from '@/lib/ollama'
import { getModelForTier } from '@/lib/tier'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question, modelAnswer, studentAnswer } = await req.json() as {
    question:      string
    modelAnswer:   string
    studentAnswer: string
  }

  if (!question || !modelAnswer || !studentAnswer) {
    return NextResponse.json({ error: 'question, modelAnswer, and studentAnswer required' }, { status: 400 })
  }

  const model = getModelForTier(session.user.tier)
  const prompt = buildGradePrompt(question, modelAnswer, studentAnswer)

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
