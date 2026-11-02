import type { Prisma } from "@prisma/client"

/**
 * Collision-free reference numbers.
 *
 * Reference numbers used to be `Math.random()` based, which collides after a
 * few dozen records because the columns are unique. They are now allocated
 * from a per-key counter row. The increment is atomic, and we additionally
 * skip numbers that already exist (people type custom refs, and legacy rows
 * were random), so allocation can never produce a duplicate.
 */

type Tx = Prisma.TransactionClient

export function formatRef(prefix: string, year: number, n: number, pad: number): string {
  return `${prefix}-${year}-${String(n).padStart(pad, "0")}`
}

async function bump(tx: Tx, key: string): Promise<number> {
  const row = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  })
  return row.value
}

async function allocate(
  tx: Tx,
  key: string,
  build: (n: number) => string,
  exists: (ref: string) => Promise<boolean>,
): Promise<string> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const ref = build(await bump(tx, key))
    if (!(await exists(ref))) return ref
  }
  throw new Error(`Could not allocate a free reference number for ${key}`)
}

export function nextQuotationRef(tx: Tx, now = new Date()): Promise<string> {
  const year = now.getFullYear()
  return allocate(
    tx,
    `quotation-${year}`,
    n => formatRef("MTS", year, n, 3),
    async ref => (await tx.quotation.count({ where: { refNo: ref } })) > 0,
  )
}

export function nextSupplierPORef(tx: Tx, now = new Date()): Promise<string> {
  const year = now.getFullYear()
  return allocate(
    tx,
    `spo-${year}`,
    n => formatRef("SPO", year, n, 4),
    async ref => (await tx.supplierPO.count({ where: { refNo: ref } })) > 0,
  )
}

/**
 * Read-only preview of the next quotation number, used to pre-fill the form.
 * It does not reserve the number - the real one is allocated on save.
 */
export async function previewQuotationRef(
  db: Pick<Prisma.TransactionClient, "counter" | "quotation">,
  now = new Date(),
): Promise<string> {
  const year = now.getFullYear()
  const row = await db.counter.findUnique({ where: { key: `quotation-${year}` } })
  let n = (row?.value ?? 0) + 1
  for (let i = 0; i < 200; i++, n++) {
    const ref = formatRef("MTS", year, n, 3)
    if ((await db.quotation.count({ where: { refNo: ref } })) === 0) return ref
  }
  return formatRef("MTS", year, n, 3)
}

/** Strip a trailing " Rev-N" to get the base reference of a revision chain. */
export function baseRef(refNo: string): string {
  return refNo.replace(/ Rev-\d+$/, "")
}
