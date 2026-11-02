import { prisma } from "@/lib/prisma"
import { UserError } from "@/lib/errors"
import { isPriced } from "@/lib/finance"
import { RECEIVED_SPO_STATUSES, canTransitionSpo } from "@/lib/status"

/**
 * Move a supplier PO to a new status, enforcing the same rules everywhere
 * this can be triggered from (the app UI, the WhatsApp agent): a legal
 * transition, a supplier and full pricing before "Sent", and a customer PO
 * only becomes Fulfilled once every supplier PO raised against it is
 * received.
 *
 * Deliberately NOT in a "use server" file - see quotation-create.ts for why.
 */
export async function transitionSpoStatusCore(spoId: string, next: string): Promise<{ cpoId: string | null }> {
  return prisma.$transaction(async tx => {
    const spo = await tx.supplierPO.findUnique({
      where: { id: spoId },
      include: { items: { select: { buyPrice: true } } },
    })
    if (!spo) throw new UserError("Supplier PO not found.")

    if (!canTransitionSpo(spo.status, next)) {
      throw new UserError(`A supplier PO cannot move from "${spo.status}" to "${next}".`)
    }

    if (next === "Sent") {
      if (!spo.supplierId) throw new UserError("Assign a supplier before sending the PO.")
      if (spo.items.length === 0) throw new UserError("The PO has no items.")
      if (spo.items.some(i => !isPriced(i.buyPrice))) {
        throw new UserError("Enter a buy price for every item before sending the PO.")
      }
    }

    await tx.supplierPO.update({
      where: { id: spoId },
      data: { status: next, statusHistory: { create: { status: next } } },
    })

    if (next === "Fully Received" && spo.cpoId) {
      const siblings = await tx.supplierPO.findMany({ where: { cpoId: spo.cpoId }, select: { status: true } })
      if (siblings.every(s => RECEIVED_SPO_STATUSES.includes(s.status))) {
        await tx.customerPO.update({ where: { id: spo.cpoId }, data: { status: "Fulfilled" } })
      }
    }

    return { cpoId: spo.cpoId }
  })
}
