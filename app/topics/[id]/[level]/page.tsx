'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PracticeLayout } from '@/components/practice/PracticeLayout'
import { QuestionPanel } from '@/components/practice/QuestionPanel'
import { AnswerPanel } from '@/components/practice/AnswerPanel'
import { HintPanel } from '@/components/practice/HintPanel'
import { Scratchpad } from '@/components/practice/Scratchpad'
import type { Question, Level } from '@/types'

export default function PracticePage() {
  const params = useParams<{ id: string; level: string }>()
  const level = parseInt(params.level, 10) as Level
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/topics/${params.id}/generate?level=${level}`)
      .then(r => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data: any) => {
        if (data.status === 'done' && data.questions) {
          setQuestions(data.questions)
        } else {
          setError('Questions not ready — go back and try again')
        }
      })
      .catch(() => setError('Failed to load questions'))
      .finally(() => setLoading(false))
  }, [params.id, level])

  if (loading) return <div className="flex items-center justify-center min-h-screen text-wabi-muted">Loading...</div>
  if (error)   return <div className="flex items-center justify-center min-h-screen text-red-600">{error}</div>
  if (!questions.length) return null

  const q = questions[current]
  const isMC = 'options' in q

  return (
    <PracticeLayout
      left={
        <QuestionPanel
          question={q.question}
          level={level}
          current={current}
          total={questions.length}
        />
      }
      right={
        <div className="flex flex-col gap-4 h-full">
          <AnswerPanel
            question={q}
            isMC={isMC}
            topicId={params.id}
            onNext={() => setCurrent(c => Math.min(c + 1, questions.length - 1))}
          />
          <HintPanel question={q.question} />
        </div>
      }
      bottom={<Scratchpad />}
    />
  )
}
