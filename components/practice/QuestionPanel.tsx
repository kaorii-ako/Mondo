'use client'
import { useEffect, useRef } from 'react'
import katex from 'katex'
import { ProgressDots } from './ProgressDots'
import type { Level } from '@/types'
import { LEVEL_LABELS } from '@/types'

function renderLatex(text: string): string {
  return text.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => {
    try { return katex.renderToString(m, { displayMode: true, throwOnError: false }) } catch { return m }
  }).replace(/\$([^$]+?)\$/g, (_, m) => {
    try { return katex.renderToString(m, { displayMode: false, throwOnError: false }) } catch { return m }
  })
}

export function QuestionPanel({ question, level, current, total }: {
  question: string
  level:    Level
  current:  number
  total:    number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = renderLatex(question)
  }, [question])

  const label = LEVEL_LABELS[level]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="font-serif text-2xl text-wabi-primary">{label.ja}</span>
          <span className="text-xs tracking-widest text-wabi-muted uppercase">{label.en}</span>
        </div>
        <ProgressDots total={total} current={current} />
      </div>
      <div className="flex-1">
        <p className="text-xs tracking-widest text-wabi-muted uppercase mb-3">Question {current + 1}</p>
        <div
          ref={ref}
          className="text-wabi-dark text-base leading-relaxed border-l-2 border-wabi-primary pl-4"
        />
      </div>
    </div>
  )
}
