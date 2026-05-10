import { describe, it, expect } from 'vitest'
import { buildGenerationPrompt } from '../ollama'

describe('buildGenerationPrompt', () => {
  it('level 1-2 prompt contains "multiple choice" and "options"', () => {
    const p = buildGenerationPrompt('Photosynthesis basics', 1)
    expect(p.system).toContain('multiple choice')
    expect(p.system).toContain('"options"')
  })

  it('level 3-5 prompt does not contain "options" key', () => {
    const p = buildGenerationPrompt('Photosynthesis basics', 3)
    expect(p.system).not.toContain('"options"')
    expect(p.system).toContain('"answer"')
  })

  it('prompt includes topic content', () => {
    const p = buildGenerationPrompt('Topic content here', 2)
    expect(p.user).toContain('Topic content here')
  })
})
