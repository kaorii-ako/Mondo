'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { LEVEL_LABELS, type Level, type Topic } from '@/types'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

const LEVELS: Level[] = [1, 2, 3, 4, 5]
const TIER_MAX: Record<string, number> = { free: 3, plus: 5, ultra: 5 }

export default function TopicDetailPage() {
  const { data: session } = useSession()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [topic, setTopic] = useState<Topic | null>(null)
  const [generating, setGenerating] = useState<Level | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/topics/${params.id}`).then(r => r.json()).then(setTopic)
  }, [params.id])

  const maxLevel = TIER_MAX[session?.user.tier ?? 'free']

  async function startLevel(level: Level) {
    setGenerating(level)
    setError('')
    const res = await fetch(`/api/topics/${params.id}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error); setGenerating(null); return }
    if (data.status === 'done') { router.push(`/topics/${params.id}/${level}`); return }

    const poll = setInterval(async () => {
      const r = await fetch(`/api/topics/${params.id}/generate?level=${level}`)
      const d = await r.json()
      if (d.status === 'done') { clearInterval(poll); router.push(`/topics/${params.id}/${level}`) }
      if (d.status === 'error') { clearInterval(poll); setError(d.error ?? 'Generation failed'); setGenerating(null) }
    }, 2000)
  }

  if (!topic) return <div className="text-center py-20 text-wabi-muted">Loading...</div>

  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <Link href="/dashboard" className="text-wabi-muted text-sm hover:text-wabi-primary">← 戻る</Link>
      <h1 className="font-serif text-3xl text-wabi-dark mt-4 mb-2">{topic.name}</h1>
      <p className="text-wabi-muted text-sm mb-8">Choose a difficulty level to practice</p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="space-y-3">
        {LEVELS.map(level => {
          const label = LEVEL_LABELS[level]
          const locked = level > maxLevel
          const busy   = generating === level

          return (
            <div key={level}
              className={`border rounded-lg p-5 flex items-center justify-between transition-colors ${
                locked ? 'border-wabi-light bg-wabi-light/30 opacity-60' : 'border-wabi-border bg-wabi-surface hover:border-wabi-primary'
              }`}
            >
              <div>
                <span className="font-serif text-xl text-wabi-primary mr-3">{label.ja}</span>
                <span className="text-wabi-dark font-medium text-sm">{label.en}</span>
                <p className="text-wabi-muted text-xs mt-0.5">{label.description}</p>
              </div>
              {locked ? (
                <span className="text-xs text-wabi-muted border border-wabi-border rounded px-2 py-1">
                  Upgrade
                </span>
              ) : (
                <Button size="sm" onClick={() => startLevel(level)} disabled={generating !== null}>
                  {busy ? '生成中...' : '開始'}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
