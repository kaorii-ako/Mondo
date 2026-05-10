import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isTopicLimitReached } from '@/lib/tier'
import { parsePdf, PdfEmptyError, PdfEncryptedError } from '@/lib/pdf'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('topics')
    .select('id, name, created_at, pdf_url')
    .eq('user_id', session.user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Enforce topic count limit
  const { count } = await supabaseAdmin
    .from('topics')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .is('deleted_at', null)

  if (isTopicLimitReached(session.user.tier, count ?? 0)) {
    return NextResponse.json(
      { error: `Topic limit reached for ${session.user.tier} tier` },
      { status: 403 }
    )
  }

  const contentType = req.headers.get('content-type') ?? ''
  let name: string
  let content_text: string | null = null
  let pdf_url: string | null = null
  let truncated = false

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    name = form.get('name') as string
    const text = form.get('text') as string | null
    const file = form.get('pdf') as File | null

    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'PDF too large (max 10 MB)' }, { status: 422 })
      }
      if (file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'Only PDF files accepted' }, { status: 422 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      try {
        const parsed = await parsePdf(buffer)
        content_text = parsed.text
        truncated = parsed.truncated
      } catch (e) {
        if (e instanceof PdfEmptyError || e instanceof PdfEncryptedError) {
          return NextResponse.json({ error: (e as Error).message }, { status: 422 })
        }
        throw e
      }

      const path = `${session.user.id}/${Date.now()}-${file.name}`
      const { data: upload, error: uploadErr } = await supabaseAdmin.storage
        .from('pdfs').upload(path, buffer, { contentType: 'application/pdf' })
      if (uploadErr) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
      pdf_url = upload.path
    } else if (text) {
      content_text = text
    }
  } else {
    const body = await req.json()
    name = body.name
    content_text = body.text ?? null
  }

  if (!name!) return NextResponse.json({ error: 'name required' }, { status: 400 })
  if (!content_text) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('topics')
    .insert({ user_id: session.user.id, name: name!, content_text, pdf_url })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, truncated }, { status: 201 })
}
