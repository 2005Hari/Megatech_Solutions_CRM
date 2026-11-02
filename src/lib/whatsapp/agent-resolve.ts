import { prisma } from "@/lib/prisma"
import { UserError } from "@/lib/errors"

/**
 * Resolve a staff-typed reference number to exactly one record: exact
 * (case-insensitive) match first, then a fuzzy "contains" match only if it
 * is unambiguous. Never guesses between several candidates - lists them and
 * asks the user to be more specific instead, the same principle used
 * everywhere else a human-typed name has to resolve to one database row.
 */
async function resolveByRefNo<T extends { refNo: string }>(
  noun: string,
  refNo: string,
  findExact: (ref: string) => Promise<T | null>,
  findMany: (ref: string) => Promise<T[]>,
): Promise<T> {
  const trimmed = refNo.trim()
  if (!trimmed) throw new UserError(`${noun} reference number is required.`)

  const exact = await findExact(trimmed)
  if (exact) return exact

  const matches = await findMany(trimmed)
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) {
    throw new UserError(`Multiple ${noun.toLowerCase()}s match "${refNo}": ${matches.map(m => m.refNo).join(", ")}. Be more specific.`)
  }
  throw new UserError(`No ${noun.toLowerCase()} found matching "${refNo}".`)
}

export function resolveQuotationByRef(refNo: string) {
  return resolveByRefNo(
    "Quotation",
    refNo,
    ref => prisma.quotation.findFirst({ where: { refNo: { equals: ref, mode: "insensitive" } } }),
    ref => prisma.quotation.findMany({ where: { refNo: { contains: ref, mode: "insensitive" } }, take: 6 }),
  )
}

export function resolveCustomerPoByRef(refNo: string) {
  return resolveByRefNo(
    "Customer PO",
    refNo,
    ref => prisma.customerPO.findFirst({ where: { refNo: { equals: ref, mode: "insensitive" } } }),
    ref => prisma.customerPO.findMany({ where: { refNo: { contains: ref, mode: "insensitive" } }, take: 6 }),
  )
}

export function resolveSupplierPoByRef(refNo: string) {
  return resolveByRefNo(
    "Supplier PO",
    refNo,
    ref => prisma.supplierPO.findFirst({ where: { refNo: { equals: ref, mode: "insensitive" } } }),
    ref => prisma.supplierPO.findMany({ where: { refNo: { contains: ref, mode: "insensitive" } }, take: 6 }),
  )
}

/**
 * Resolve a staff-written customer name to exactly one Customer. Used both
 * by `create_quotation` and the read tools - unmatched or ambiguous names
 * are never guessed.
 */
export async function resolveCustomerByName(
  name: string,
): Promise<{ id: string; name: string; contactDetails: string | null } | { ambiguous: string[] } | null> {
  const trimmed = name.trim()
  if (!trimmed) return null
  const matches = await prisma.customer.findMany({
    where: { name: { contains: trimmed, mode: "insensitive" } },
    take: 6,
    select: { id: true, name: true, contactDetails: true },
  })
  if (matches.length === 1) return matches[0]
  if (matches.length > 1) return { ambiguous: matches.map(m => m.name) }
  return null
}
