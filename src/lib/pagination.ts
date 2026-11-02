export const PAGE_SIZE = 25

/** Parse a `?page=` value into a safe 1-based page number. */
export function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const n = Number.parseInt(raw ?? "1", 10)
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 100_000) : 1
}

export function pageWindow(page: number, total: number, pageSize = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pages)
  return { current, pages, skip: (current - 1) * pageSize, take: pageSize }
}
