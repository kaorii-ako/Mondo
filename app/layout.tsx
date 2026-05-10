import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AnyTutor',
  description: 'AI-powered personal tutor for any subject',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-wabi-bg text-wabi-dark min-h-screen font-sans">
        {children}
      </body>
    </html>
  )
}
