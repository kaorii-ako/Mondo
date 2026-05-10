import pdfParse from 'pdf-parse'

const MAX_CHARS = 15_000

export class PdfEmptyError extends Error {
  constructor() { super('Could not extract text — please paste content manually') }
}

export class PdfEncryptedError extends Error {
  constructor() { super('Encrypted PDF — please paste text manually') }
}

export async function parsePdf(buffer: Buffer): Promise<{ text: string; truncated: boolean }> {
  let result: { text: string; numpages: number }
  try {
    result = await pdfParse(buffer)
  } catch (e: any) {
    if (e?.message?.includes('encrypted') || e?.message?.includes('password')) {
      throw new PdfEncryptedError()
    }
    throw e
  }

  const raw = result.text.trim()
  if (!raw) throw new PdfEmptyError()

  const truncated = raw.length > MAX_CHARS
  return { text: truncated ? raw.slice(0, MAX_CHARS) : raw, truncated }
}
