export function PracticeLayout({ left, right, bottom }: {
  left:   React.ReactNode
  right:  React.ReactNode
  bottom: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-wabi-bg flex flex-col">
      <div className="flex-1 flex flex-col md:flex-row min-h-0 border-b border-wabi-border">
        <div className="flex-1 p-6 md:p-8 border-b md:border-b-0 md:border-r border-wabi-border overflow-y-auto">
          {left}
        </div>
        <div className="flex-1 p-6 md:p-8 flex flex-col gap-4 overflow-y-auto">
          {right}
        </div>
      </div>
      <div className="border-t border-wabi-border">
        {bottom}
      </div>
    </div>
  )
}
