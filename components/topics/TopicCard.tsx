import { Topic } from '@/types'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

export function TopicCard({ topic, onDelete }: { topic: Topic; onDelete: (id: string) => void }) {
  return (
    <div className="bg-wabi-surface border border-wabi-border rounded-lg p-5 flex items-start justify-between group">
      <div>
        <Link href={`/topics/${topic.id}`} className="font-serif text-lg text-wabi-dark hover:text-wabi-primary transition-colors">
          {topic.name}
        </Link>
        <p className="text-wabi-muted text-xs mt-1">
          {new Date(topic.created_at).toLocaleDateString()}
          {topic.pdf_url && ' · PDF'}
        </p>
      </div>
      <Button
        variant="ghost" size="sm"
        onClick={() => onDelete(topic.id)}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      >
        削除
      </Button>
    </div>
  )
}
