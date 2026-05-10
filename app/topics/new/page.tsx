import { TopicForm } from '@/components/topics/TopicForm'
import Link from 'next/link'

export default function NewTopicPage() {
  return (
    <main className="max-w-xl mx-auto px-4 py-10">
      <Link href="/dashboard" className="text-wabi-muted text-sm hover:text-wabi-primary">← 戻る</Link>
      <h1 className="font-serif text-3xl text-wabi-dark mt-4 mb-8">新しいトピック</h1>
      <TopicForm />
    </main>
  )
}
