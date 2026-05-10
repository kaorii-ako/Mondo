import { describe, it, expect, vi } from 'vitest'

vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}))

describe('parsePdf', () => {
  it('returns extracted text', async () => {
    const { default: pdfParse } = await import('pdf-parse')
    vi.mocked(pdfParse).mockResolvedValueOnce({ text: 'hello world', numpages: 2 } as any)
    const { parsePdf } = await import('../pdf')
    const result = await parsePdf(Buffer.from('fake'))
    expect(result.text).toBe('hello world')
    expect(result.truncated).toBe(false)
  })

  it('truncates text exceeding 15000 chars and sets truncated=true', async () => {
    const { default: pdfParse } = await import('pdf-parse')
    vi.mocked(pdfParse).mockResolvedValueOnce({ text: 'a'.repeat(20000), numpages: 5 } as any)
    const { parsePdf } = await import('../pdf')
    const result = await parsePdf(Buffer.from('fake'))
    expect(result.text.length).toBe(15000)
    expect(result.truncated).toBe(true)
  })

  it('throws PdfEmptyError when text is empty', async () => {
    const { default: pdfParse } = await import('pdf-parse')
    vi.mocked(pdfParse).mockResolvedValueOnce({ text: '', numpages: 1 } as any)
    const { parsePdf, PdfEmptyError } = await import('../pdf')
    await expect(parsePdf(Buffer.from('fake'))).rejects.toThrow(PdfEmptyError)
  })

  it('throws PdfEncryptedError for encrypted PDFs', async () => {
    const { default: pdfParse } = await import('pdf-parse')
    vi.mocked(pdfParse).mockRejectedValueOnce(new Error('password required'))
    const { parsePdf, PdfEncryptedError } = await import('../pdf')
    await expect(parsePdf(Buffer.from('fake'))).rejects.toThrow(PdfEncryptedError)
  })
})
