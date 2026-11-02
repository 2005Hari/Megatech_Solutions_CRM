import Link from "next/link"

export default function NotFound() {
  return (
    <div className="p-8 max-w-xl mx-auto">
      <div className="rounded-xl border border-card-border bg-card p-6">
        <h1 className="text-lg font-semibold text-foreground">Not found</h1>
        <p className="text-sm text-muted-foreground mt-1">
          That record doesn&apos;t exist - it may have been deleted.
        </p>
        <Link href="/" className="inline-block mt-4 text-sm font-medium text-accent hover:underline">
          ← Back to overview
        </Link>
      </div>
    </div>
  )
}
