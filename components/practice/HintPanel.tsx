'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function HintPanel({ question }: { question: string }) {
  const [hints, setHints]       = useState<string[]>([])
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [limitHit, setLimitHit] = useState(false)

  const nextHintNum = hints.length + 1
  const canGetHint  = nextHintNum <= 3 && !loading && !limitHit

  async function getHint() {
    setLoading(true)
    setExpanded(true)
    const res = await fetch('/api/practice/hint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, hintNumber: nextHintNum }),
    })

    if (res.status === 429) { setLimitHit(true); setLoading(false); return }
    if (!res.ok) { setLoading(false); return }

    let text = ''
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    const idx = hints.length
    setHints(h => [...h, ''])
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      text += dec.decode(value)
      setHints(h => h.map((x, i) => i === idx ? text : x))
    }
    setLoading(false)
  }

  return (
    <div className="border border-dashed border-wabi-border rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm text-wabi-muted hover:text-wabi-primary transition-colors"
      >
        <span>💡 ヒント · Hints {hints.length > 0 && `(${hints.length}/3 used)`}</span>
        <span>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {hints.map((h, i) => (
            <div key={i} className="text-sm text-wabi-dark border-l-2 border-wabi-light pl-3">
              <span className="text-xs text-wabi-muted uppercase tracking-widest">Hint {i + 1}</span>
              <p className="mt-1">{h}</p>
            </div>
          ))}
          {limitHit && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">Daily hint limit reached</p>
          )}
          {canGetHint && (
            <Button variant="ghost" size="sm" onClick={getHint} disabled={loading}>
              {loading ? '考え中...' : `Get Hint ${nextHintNum}`}
            </Button>
          )}
          {hints.length === 3 && !limitHit && (
            <p className="text-xs text-wabi-muted">All hints used. Try solving it yourself!</p>
          )}
        </div>
      )}
    </div>
  )
}
