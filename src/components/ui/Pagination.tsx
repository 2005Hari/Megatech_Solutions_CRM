import Link from "next/link"

/** Server-rendered prev/next links driven by `?page=`. */
export default function Pagination({
  basePath,
  page,
  pages,
  total,
}: {
  basePath: string
  page: number
  pages: number
  total: number
}) {
  if (pages <= 1) return null
  const href = (p: number) => (p === 1 ? basePath : `${basePath}?page=${p}`)
  const link = "px-3 py-1.5 border border-card-border rounded-md text-sm font-medium hover:bg-muted transition-colors"
  const off = "px-3 py-1.5 border border-card-border rounded-md text-sm text-muted-foreground opacity-50"

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between px-4 py-3 border-t border-card-border text-sm">
      <span className="text-muted-foreground">
        Page {page} of {pages} · {total} records
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={link}>
            Previous
          </Link>
        ) : (
          <span className={off}>Previous</span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className={link}>
            Next
          </Link>
        ) : (
          <span className={off}>Next</span>
        )}
      </div>
    </nav>
  )
}
