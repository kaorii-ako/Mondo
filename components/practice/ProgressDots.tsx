export function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex gap-1.5 items-center">
      {Array.from({ length: total }, (_, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'pending'
        return (
          <div
            key={i}
            data-testid="progress-dot"
            data-state={state}
            className={`rounded-full transition-all ${
              state === 'done'    ? 'w-2.5 h-2.5 bg-wabi-primary' :
              state === 'current' ? 'w-3 h-3 border-2 border-wabi-primary bg-wabi-bg' :
                                   'w-2.5 h-2.5 bg-wabi-light'
            }`}
          />
        )
      })}
    </div>
  )
}
