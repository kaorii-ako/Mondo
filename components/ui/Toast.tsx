'use client'
import { useEffect } from 'react'

export function Toast({ message, type = 'info', onDismiss }: {
  message: string
  type?: 'info' | 'error' | 'success'
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const colors = {
    info:    'bg-wabi-surface border-wabi-border text-wabi-dark',
    error:   'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
  }

  return (
    <div className={`fixed bottom-6 right-6 border rounded-lg px-4 py-3 text-sm shadow-md z-50 max-w-sm ${colors[type]}`}>
      {message}
    </div>
  )
}
