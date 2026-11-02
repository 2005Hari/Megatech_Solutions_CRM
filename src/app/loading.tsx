export default function Loading() {
  return (
    <div className="p-8 max-w-6xl mx-auto space-y-4" role="status" aria-label="Loading">
      <div className="h-7 w-56 rounded bg-muted animate-pulse" />
      <div className="h-4 w-80 rounded bg-muted/70 animate-pulse" />
      <div className="mt-6 rounded-xl border border-card-border bg-card divide-y divide-card-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse bg-muted/20" />
        ))}
      </div>
    </div>
  )
}
