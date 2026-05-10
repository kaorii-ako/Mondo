'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

type Tab = 'text' | 'pdf'

export function TopicForm() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('text')
  const [name, setName] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (tab === 'pdf' && !file) {
        setError('Please select a PDF file')
        setLoading(false)
        return
      }

      let res: Response
      if (tab === 'pdf' && file) {
        const fd = new FormData()
        fd.append('name', name)
        fd.append('pdf', file)
        res = await fetch('/api/topics', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, text }),
        })
      }

      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      if (data.truncated) alert('PDF was truncated to first ~15,000 characters')
      router.push(`/topics/${data.id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-xs tracking-widest text-wabi-muted uppercase mb-1">Topic Name</label>
        <input
          value={name} onChange={e => setName(e.target.value)} required
          placeholder="e.g. Quadratic Equations"
          className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary"
        />
      </div>

      <div>
        <div className="flex border-b border-wabi-border mb-4">
          {(['text', 'pdf'] as Tab[]).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm transition-colors ${tab === t ? 'border-b-2 border-wabi-primary text-wabi-primary' : 'text-wabi-muted'}`}>
              {t === 'text' ? 'Paste Text' : 'Upload PDF'}
            </button>
          ))}
        </div>

        {tab === 'text' ? (
          <textarea
            value={text} onChange={e => setText(e.target.value)} required
            placeholder="Paste your topic content, notes, or textbook excerpt here..."
            rows={8}
            className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary resize-y"
          />
        ) : (
          <div
            onClick={() => document.getElementById('pdf-input')?.click()}
            className="border-2 border-dashed border-wabi-border rounded-lg p-10 text-center cursor-pointer hover:border-wabi-primary transition-colors"
          >
            <input id="pdf-input" type="file" accept="application/pdf" className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <p className="text-wabi-dark text-sm">{file.name}</p>
            ) : (
              <p className="text-wabi-muted text-sm">Click to upload PDF (max 10 MB)</p>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Creating...' : 'Create Topic →'}
      </Button>
    </form>
  )
}
