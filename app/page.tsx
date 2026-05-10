import Link from 'next/link'

const FEATURES = [
  { ja: '問題生成', en: 'AI Question Generation',    desc: '5 levels from basic recall to Olympic difficulty' },
  { ja: '数式入力', en: 'Live Math Editor',           desc: 'MathLive scratchpad with full LaTeX and chemistry symbols' },
  { ja: 'ヒント',  en: 'Progressive Hints',          desc: 'Up to 3 hints per question — nudges, not answers' },
  { ja: '全教科',  en: 'Any Subject',                 desc: 'Upload a PDF or paste text — works for any topic' },
]

const TIERS = [
  { name: 'Free',  ja: '無料',   topics: '3',  levels: '1–3', hints: '5/day',  model: 'Standard' },
  { name: 'Plus',  ja: 'プラス', topics: '20', levels: '1–5', hints: '50/day', model: 'Pro' },
  { name: 'Ultra', ja: '超',     topics: '∞',  levels: '1–5', hints: '∞',       model: 'Pro' },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-wabi-border">
        <span className="font-serif text-xl text-wabi-dark tracking-wide">AnyTutor</span>
        <div className="flex gap-3">
          <Link href="/auth/login"  className="text-sm text-wabi-muted hover:text-wabi-primary transition-colors">Sign in</Link>
          <Link href="/auth/signup" className="text-sm bg-wabi-primary text-wabi-bg px-4 py-1.5 rounded hover:bg-wabi-dark transition-colors">Get started</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-2xl mx-auto text-center px-6 py-24">
        <p className="text-wabi-muted tracking-widest text-xs uppercase mb-4">個人AI家庭教師</p>
        <h1 className="font-serif text-5xl text-wabi-dark leading-tight mb-6">
          Your personal<br />AI tutor
        </h1>
        <p className="text-wabi-muted text-lg mb-10">
          Upload any topic — get 5 levels of practice questions,<br />
          live math editing, and smart hints.
        </p>
        <Link href="/auth/signup"
          className="inline-block bg-wabi-primary text-wabi-bg px-8 py-3 rounded-lg text-sm hover:bg-wabi-dark transition-colors">
          Start for free →
        </Link>
      </section>

      {/* Features */}
      <section className="max-w-2xl mx-auto px-6 pb-20 grid grid-cols-2 gap-4">
        {FEATURES.map(f => (
          <div key={f.ja} className="bg-wabi-surface border border-wabi-border rounded-lg p-5">
            <p className="font-serif text-wabi-primary text-xl mb-1">{f.ja}</p>
            <p className="text-wabi-dark font-medium text-sm">{f.en}</p>
            <p className="text-wabi-muted text-xs mt-1">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Tier table */}
      <section className="max-w-xl mx-auto px-6 pb-24">
        <h2 className="font-serif text-2xl text-center text-wabi-dark mb-8">料金プラン</h2>
        <div className="border border-wabi-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-wabi-border bg-wabi-surface">
                <th className="text-left px-4 py-3 text-wabi-muted font-normal"></th>
                {TIERS.map(t => (
                  <th key={t.name} className="px-4 py-3 text-center text-wabi-dark font-serif">
                    <div className="text-lg text-wabi-primary">{t.ja}</div>
                    <div className="text-xs text-wabi-muted font-normal">{t.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Topics',   key: 'topics' },
                { label: 'Levels',   key: 'levels' },
                { label: 'Hints',    key: 'hints' },
                { label: 'AI Model', key: 'model' },
              ].map(row => (
                <tr key={row.label} className="border-b border-wabi-border last:border-0">
                  <td className="px-4 py-3 text-wabi-muted">{row.label}</td>
                  {TIERS.map(t => (
                    <td key={t.name} className="px-4 py-3 text-center text-wabi-dark">
                      {(t as any)[row.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
