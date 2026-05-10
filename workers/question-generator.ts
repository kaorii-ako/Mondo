import { Worker } from 'bullmq'
import IORedis from 'ioredis'
import { createClient } from '@supabase/supabase-js'
import { buildGenerationPrompt, ollamaGenerate } from '../lib/ollama'
import type { GenerationJobData } from '../lib/queue'

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const concurrency = parseInt(process.env.OLLAMA_CONCURRENCY ?? '2', 10)

const worker = new Worker<GenerationJobData>(
  'question-generation',
  async (job) => {
    const { topicId, level, topicContent, model } = job.data

    await supabase.from('question_sets')
      .upsert({ topic_id: topicId, level, questions: [], job_status: 'processing' },
               { onConflict: 'topic_id,level' })

    const prompt = buildGenerationPrompt(topicContent, level)
    const raw = await ollamaGenerate(model, prompt)

    let questions: unknown[]
    try {
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      questions = JSON.parse(cleaned)
      if (!Array.isArray(questions)) throw new Error('Not an array')
    } catch {
      throw new Error(`Failed to parse Ollama response: ${raw.slice(0, 200)}`)
    }

    await supabase.from('question_sets')
      .upsert(
        { topic_id: topicId, level, questions, job_status: 'done', generated_at: new Date().toISOString() },
        { onConflict: 'topic_id,level' }
      )
  },
  { connection, concurrency }
)

worker.on('failed', async (job, err) => {
  if (!job) return
  const { topicId, level } = job.data
  await supabase.from('question_sets')
    .upsert(
      { topic_id: topicId, level, questions: [], job_status: 'error', job_error: err.message },
      { onConflict: 'topic_id,level' }
    )
})

console.log(`Question generation worker started (concurrency=${concurrency})`)

process.on('SIGTERM', async () => {
  await worker.close()
  connection.quit()
  process.exit(0)
})
