'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { TopicCard } from '@/components/topics/TopicCard'
import { Button } from '@/components/ui/Button'
import { Toast } from '@/components/ui/Toast'
import type { Topic } from '@/types'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null)

  useEffect(() => {
    fetch('/api/topics').then(r => r.json()).then(setTopics).finally(() => setLoading(false))
  }, [])

  async function handleDelete(id: string) {
    await fetch(`/api/topics/${id}`, { method: 'DELETE' })
    setTopics(t => t.filter(x => x.id !== id))
    setToast({ message: 'Topic deleted', type: 'success' })
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-wabi-dark">学習</h1>
          <p className="text-wabi-muted text-sm mt-1">
            {session?.user.name ?? session?.user.email} · {session?.user.tier}
          </p>
        </div>
        <Link href="/topics/new">
          <Button>＋ New Topic</Button>
        </Link>
      </div>

      {loading && <p className="text-wabi-muted text-sm">Loading...</p>}

      {!loading && topics.length === 0 && (
        <div className="text-center py-16 text-wabi-muted">
          <p className="font-serif text-xl mb-2">まだ何もない</p>
          <p className="text-sm">No topics yet — create your first one</p>
        </div>
      )}

      <div className="space-y-3">
        {topics.map(t => <TopicCard key={t.id} topic={t} onDelete={handleDelete} />)}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </main>
  )
}
