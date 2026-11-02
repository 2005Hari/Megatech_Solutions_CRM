import { prisma } from "@/lib/prisma"
import { UserError } from "@/lib/errors"
import { EDITABLE_SPO_STATUSES } from "@/lib/status"
import { money } from "@/lib/validation"

export type PriceUpdate = { productName: string; buyPrice: number }

/**
 * Set buy prices on EXISTING items of a supplier PO, matched by product name
 * (case-insensitive, must be unambiguous). Deliberately narrower than the
 * full `updateSupplierPO` action: it can only change a price on a line that
 * is already there - never rename, add, remove an item, or change the
 * supplier/dates. That is the whole point of exposing this one as an agent
 * tool: the worst a wrong price guess can do is a wrong number, never a
 * structurally different PO.
 *
 * Not in a "use server" file - see quotation-create.ts.
 */
export async function setSpoItemPricesCore(
  spoId: string,
  updates: PriceUpdate[],
): Promise<{ cpoId: string | null; updated: { productName: string; buyPrice: number }[]; notFound: string[] }> {
  if (updates.length === 0) throw new UserError("No prices to update.")

  return prisma.$transaction(async tx => {
    const spo = await tx.supplierPO.findUnique({
      where: { id: spoId },
      include: { items: { select: { id: true, productName: true } } },
    })
    if (!spo) throw new UserError("Supplier PO not found.")
    if (!EDITABLE_SPO_STATUSES.includes(spo.status)) {
      throw new UserError(`A supplier PO with status "${spo.status}" can no longer be edited.`)
    }

    const updated: { productName: string; buyPrice: number }[] = []
    const notFound: string[] = []

    for (const u of updates) {
      const price = money(u.buyPrice, `Buy price for "${u.productName}"`)
      const matches = spo.items.filter(i => i.productName.toLowerCase().includes(u.productName.toLowerCase()))
      if (matches.length !== 1) {
        notFound.push(u.productName)
        continue
      }
      await tx.supplierPOItem.update({ where: { id: matches[0].id }, data: { buyPrice: price } })
      updated.push({ productName: matches[0].productName, buyPrice: price })
    }

    return { cpoId: spo.cpoId, updated, notFound }
  })
}
