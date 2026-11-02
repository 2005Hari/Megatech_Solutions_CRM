import type { Prisma } from "@prisma/client"
import { nextSupplierPORef } from "./refs"

/**
 * Create the draft supplier PO for a customer PO.
 *
 * Deliberately NOT in a "use server" file: every export of those files is a
 * publicly callable endpoint, and this must only run from other server code,
 * inside the caller's transaction.
 */
export async function createSupplierPODraft(tx: Prisma.TransactionClient, cpoId: string) {
  const cpo = await tx.customerPO.findUnique({
    where: { id: cpoId },
    include: { items: true },
  })
  if (!cpo) throw new Error(`CPO ${cpoId} not found`)

  return tx.supplierPO.create({
    data: {
      refNo: await nextSupplierPORef(tx),
      date: new Date(),
      status: "Draft",
      cpoId: cpo.id,
      items: {
        create: cpo.items.map(item => ({
          productName: item.productName,
          qty: item.qty,
          unit: item.unit,
          buyPrice: null, // not priced until the supplier quotes
          cpoItemId: item.id,
        })),
      },
      statusHistory: { create: { status: "Draft" } },
    },
  })
}
