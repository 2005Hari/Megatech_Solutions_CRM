"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { UserError } from "@/lib/errors"
import { requiredId } from "@/lib/validation"

/**
 * Delete a customer PO. Untouched draft supplier POs raised from it are
 * removed with it; anything further along blocks the delete so purchasing
 * history is never silently destroyed.
 */
export async function deleteCPO(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Customer PO")

    await prisma.$transaction(async tx => {
      const spos = await tx.supplierPO.findMany({ where: { cpoId: id }, select: { id: true, refNo: true, status: true } })
      const inProgress = spos.filter(s => s.status !== "Draft")
      if (inProgress.length > 0) {
        throw new UserError(
          `Supplier PO ${inProgress.map(s => s.refNo).join(", ")} is already in progress. Delete or close it first.`,
        )
      }
      if (spos.length > 0) await tx.supplierPO.deleteMany({ where: { cpoId: id } })
      await tx.customerPO.delete({ where: { id } })
    })

    revalidatePath("/")
    revalidatePath("/cpo")
    revalidatePath("/spo")
  })
}
