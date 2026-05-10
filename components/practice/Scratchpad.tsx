'use client'
import { useEffect, useRef, useState } from 'react'

const MATH_SYMBOLS = [
  { label: '√', latex: '\\sqrt{}' },
  { label: '∫', latex: '\\int' },
  { label: 'π', latex: '\\pi' },
  { label: 'Σ', latex: '\\sum' },
  { label: '∂', latex: '\\partial' },
  { label: '∞', latex: '\\infty' },
  { label: '±', latex: '\\pm' },
  { label: 'sin', latex: '\\sin()' },
  { label: 'cos', latex: '\\cos()' },
  { label: 'tan', latex: '\\tan()' },
  { label: 'log', latex: '\\log' },
  { label: 'ln',  latex: '\\ln' },
  { label: 'x²',  latex: '^{2}' },
  { label: 'xₙ',  latex: '_{}' },
  { label: 'a/b', latex: '\\frac{}{}' },
]

const CHEM_SYMBOLS = [
  { label: '→',   latex: '\\rightarrow' },
  { label: '⇌',   latex: '\\rightleftharpoons' },
  { label: 'H₂',  latex: 'H_{2}' },
  { label: 'O₂',  latex: 'O_{2}' },
  { label: 'CO₂', latex: 'CO_{2}' },
  { label: '°C',  latex: '^{\\circ}C' },
]

export function Scratchpad() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mfRef        = useRef<any>(null)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (!containerRef.current || !open) return
    import('mathlive').then(({ MathfieldElement }) => {
      if (mfRef.current) return
      const mf = new MathfieldElement()
      mf.style.cssText = 'width:100%;min-height:60px;font-size:1.1rem;border:none;outline:none;background:transparent;'
      mf.setAttribute('placeholder', 'Type math here — use keyboard or click symbols above...')
      containerRef.current!.appendChild(mf)
      mfRef.current = mf
    })
  }, [open])

  function insertSymbol(latex: string) {
    mfRef.current?.executeCommand(['insert', latex])
    mfRef.current?.focus()
  }

  function clear() {
    if (mfRef.current) mfRef.current.value = ''
  }

  return (
    <div className="bg-wabi-surface">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-xs tracking-widest text-wabi-muted uppercase hover:text-wabi-primary transition-colors"
      >
        <span>✎ Scratchpad</span>
        <span>{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {MATH_SYMBOLS.map(s => (
              <button key={s.label} type="button" onClick={() => insertSymbol(s.latex)}
                className="px-2.5 py-1 text-xs bg-wabi-bg border border-wabi-border rounded hover:border-wabi-primary hover:text-wabi-primary transition-colors font-mono">
                {s.label}
              </button>
            ))}
            <span className="w-px h-5 self-center bg-wabi-border mx-1" />
            {CHEM_SYMBOLS.map(s => (
              <button key={s.label} type="button" onClick={() => insertSymbol(s.latex)}
                className="px-2.5 py-1 text-xs bg-wabi-bg border border-wabi-border rounded hover:border-wabi-primary hover:text-wabi-primary transition-colors font-mono">
                {s.label}
              </button>
            ))}
            <button type="button" onClick={clear}
              className="ml-auto px-2.5 py-1 text-xs text-wabi-muted hover:text-red-600 transition-colors">
              Clear
            </button>
          </div>
          <div ref={containerRef}
            className="bg-wabi-bg border border-wabi-border rounded-lg px-4 py-3 min-h-[64px]" />
        </div>
      )}
    </div>
  )
}
