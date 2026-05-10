'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const res = await signIn('credentials', {
      email: fd.get('email'),
      password: fd.get('password'),
      name: fd.get('name'),
      mode: 'signup',
      redirect: false,
    })
    setLoading(false)
    if (res?.error) { setError('Could not create account. Try a different email or password.'); return }
    router.push('/dashboard')
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm bg-wabi-surface border border-wabi-border rounded-lg p-8">
        <h1 className="font-serif text-2xl text-wabi-dark mb-1">はじめる</h1>
        <p className="text-wabi-muted text-sm mb-6">Create your account</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input name="name" type="text" placeholder="Name (optional)"
            className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary" />
          <input name="email" type="email" required placeholder="Email"
            className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary" />
          <input name="password" type="password" required placeholder="Password (min 8 chars)"
            minLength={8}
            className="w-full bg-wabi-bg border border-wabi-border rounded px-3 py-2 text-sm focus:outline-none focus:border-wabi-primary" />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-wabi-primary text-wabi-bg rounded py-2 text-sm hover:bg-wabi-dark transition-colors disabled:opacity-60">
            {loading ? '...' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-wabi-muted text-sm mt-4">
          Have an account? <Link href="/auth/login" className="text-wabi-primary underline">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
