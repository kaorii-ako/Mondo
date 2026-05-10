'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { Question, MCQuestion } from '@/types'

type GradeResult = { score: number; feedback: string; reasoning: string }

interface AnswerPanelProps {
  question: Question
  isMC:     boolean
  topicId:  string
  onNext:   () => void
}

export function AnswerPanel({ question, isMC, onNext }: AnswerPanelProps) {
  const [selected, setSelected] = useState<string>('')
  const [freeText, setFreeText] = useState('')
  const [result, setResult] = useState<{ correct?: boolean; grade?: GradeResult } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    if (isMC) {
      const mc = question as MCQuestion
      const correct = selected === mc.answer
      setResult({ correct })
      setLoading(false)
      return
    }

    const res = await fetch('/api/practice/grade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question:      question.question,
        modelAnswer:   question.answer,
        studentAnswer: freeText,
      }),
    })

    if (!res.ok) {
      setResult({ grade: { score: 0, feedback: 'Server busy — try again in a moment', reasoning: '' } })
      setLoading(false)
      return
    }

    let raw = ''
    const reader = res.body!.getReader()
    const dec = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      raw += dec.decode(value)
    }
    try {
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
      const grade = JSON.parse(cleaned) as GradeResult
      setResult({ grade })
    } catch {
      setResult({ grade: { score: 0, feedback: 'Could not parse grade — try again', reasoning: '' } })
    }
    setLoading(false)
  }

  const OPTION_LABELS = ['A', 'B', 'C', 'D']

  return (
    <div className="flex flex-col gap-3 flex-1">
      <p className="text-xs tracking-widest text-wabi-muted uppercase">Your Answer</p>

      {isMC ? (
        <div className="space-y-2">
          {(question as MCQuestion).options.map((opt, i) => {
            const letter = OPTION_LABELS[i]
            const isSelected = selected === letter
            const mc = question as MCQuestion
            const showResult = result !== null
            const correct = letter === mc.answer
            let cls = 'border rounded-lg px-4 py-3 text-sm cursor-pointer transition-colors w-full text-left flex items-start gap-3 '
            if (showResult) {
              cls += correct ? 'border-green-400 bg-green-50 text-green-800 ' : isSelected ? 'border-red-300 bg-red-50 text-red-800 ' : 'border-wabi-border text-wabi-muted '
            } else {
              cls += isSelected ? 'border-wabi-primary bg-wabi-surface text-wabi-dark ' : 'border-wabi-border hover:border-wabi-primary text-wabi-dark '
            }
            return (
              <button key={letter} className={cls} onClick={() => !result && setSelected(letter)}>
                <span className="font-serif font-bold text-wabi-primary w-4 shrink-0">{letter}</span>
                <span>{opt}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <textarea
          value={freeText}
          onChange={e => setFreeText(e.target.value)}
          disabled={result !== null}
          placeholder="Write your answer here..."
          rows={5}
          className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary resize-none"
        />
      )}

      {result && (
        <div className={`rounded-lg p-4 text-sm ${
          result.correct === true || (result.grade && result.grade.score >= 60)
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {isMC ? (
            <>
              <p className="font-medium">{result.correct ? '正解 · Correct!' : '不正解 · Incorrect'}</p>
              <p className="mt-1 text-xs">{(question as MCQuestion).explanation}</p>
            </>
          ) : result.grade ? (
            <>
              <p className="font-medium">Score: {result.grade.score}/100</p>
              <p className="mt-1">{result.grade.feedback}</p>
            </>
          ) : null}
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        {!result ? (
          <Button onClick={handleSubmit} disabled={loading || (!isMC && !freeText) || (isMC && !selected)} className="flex-1">
            {loading ? '採点中...' : '答える · Submit'}
          </Button>
        ) : (
          <Button onClick={() => { setResult(null); setSelected(''); setFreeText(''); onNext() }} className="flex-1">
            次へ · Next →
          </Button>
        )}
      </div>
    </div>
  )
}
