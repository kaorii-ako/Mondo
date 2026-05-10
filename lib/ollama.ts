const BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

interface Prompt { system: string; user: string }

export function buildGenerationPrompt(topicContent: string, level: number): Prompt {
  const isMC = level <= 2

  const levelDesc: Record<number, string> = {
    1: 'basic key-concept recall',
    2: 'applying the concept in a straightforward scenario',
    3: 'multi-step reasoning requiring multiple concepts',
    4: 'hard edge cases and complex problem-solving',
    5: 'Olympic/competition difficulty — research level',
  }

  const system = isMC
    ? `You are an expert tutor. Generate exactly 5 multiple choice questions at difficulty: ${levelDesc[level]}.
Return ONLY a JSON array with no markdown. Each element must have:
{"question": string, "options": [string, string, string, string], "answer": "A"|"B"|"C"|"D", "explanation": string}
The answer letter must correspond to the correct option in the "options" array (index 0=A, 1=B, 2=C, 3=D).`
    : `You are an expert tutor. Generate exactly 5 free-response questions at difficulty: ${levelDesc[level]}.
Return ONLY a JSON array with no markdown. Each element must have:
{"question": string, "answer": string, "explanation": string}`

  const user = `Topic content:\n\n${topicContent}\n\nGenerate 5 questions now.`
  return { system, user }
}

export function buildGradePrompt(question: string, modelAnswer: string, studentAnswer: string): Prompt {
  return {
    system: `You are a fair and encouraging tutor grading a student's answer.
Return ONLY JSON: {"score": number 0-100, "feedback": string, "reasoning": string}
score 90-100: essentially correct, score 60-89: partially correct with gaps, score 0-59: incorrect or missing key points.
Never reveal the full model answer. feedback should guide the student.`,
    user: `Question: ${question}\nModel answer: ${modelAnswer}\nStudent answer: ${studentAnswer}`,
  }
}

export function buildHintPrompt(question: string, hintNumber: number): Prompt {
  const depth = [
    'a very gentle nudge pointing to the right approach (do NOT reveal the answer)',
    'a more specific hint about the method to use (do NOT give the answer)',
    'a near-answer hint — describe what the answer looks like without stating it',
  ][hintNumber - 1]
  return {
    system: `You are a tutor giving hint ${hintNumber}/3. Give ${depth}. Be concise (2-3 sentences max).`,
    user: `Question: ${question}`,
  }
}

export async function ollamaGenerate(
  model: string,
  prompt: Prompt,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user',   content: prompt.user },
      ],
      stream: false,
    }),
    signal,
  })
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)
  const data = await res.json()
  return data.message?.content ?? ''
}

export async function* ollamaStream(
  model: string,
  prompt: Prompt,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user',   content: prompt.user },
      ],
      stream: true,
    }),
    signal,
  })
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)

  const reader = res.body!.getReader()
  const dec = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = dec.decode(value).split('\n').filter(Boolean)
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        if (obj.message?.content) yield obj.message.content
      } catch {}
    }
  }
}
