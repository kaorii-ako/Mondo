import { Queue } from 'bullmq'
import IORedis from 'ioredis'

export const redisConnection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

export const questionQueue = new Queue('question-generation', { connection: redisConnection })

export interface GenerationJobData {
  topicId:      string
  level:        number
  topicContent: string
  model:        string
}

export async function enqueueGeneration(data: GenerationJobData): Promise<string | undefined> {
  const job = await questionQueue.add('generate', data, {
    attempts:  3,
    backoff:   { type: 'exponential', delay: 5000 },
    timeout:   120_000,
  })
  return job.id
}

process.on('SIGTERM', async () => {
  await questionQueue.close()
  redisConnection.quit()
})
