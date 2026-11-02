import { prisma } from "@/lib/prisma"
import { UserError } from "@/lib/errors"
import { canTransitionQuotation } from "@/lib/status"

/**
 * Move a quotation to a new status, enforcing the same transition table
 * everywhere this can be triggered from. Not in a "use server" file - see
 * quotation-create.ts.
 */
export async function setQuotationStatusCore(id: string, next: string): Promise<void> {
  const existing = await prisma.quotation.findUnique({ where: { id }, select: { status: true } })
  if (!existing) throw new UserError("Quotation not found.")
  if (!canTransitionQuotation(existing.status, next)) {
    throw new UserError(`A quotation cannot move from "${existing.status}" to "${next}".`)
  }
  await prisma.quotation.update({ where: { id }, data: { status: next } })
}
