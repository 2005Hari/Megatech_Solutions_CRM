import { prisma } from "@/lib/prisma"
import { UserError } from "@/lib/errors"
import { EDITABLE_SPO_STATUSES } from "@/lib/status"

/**
 * Delete guards shared by the UI actions and the WhatsApp agent's delete
 * tools. Not in "use server" files - see quotation-create.ts. These are the
 * one class of agent tool that is irreversible, so the agent layer gates
 * them behind an explicit, non-LLM confirmation step before ever calling
 * these (see src/lib/whatsapp/agent-tools.ts) - the guards below are the
 * same business rules the app UI already enforces, not an additional
 * safety net by themselves.
 */

export async function deleteQuotationCore(id: string): Promise<void> {
  const [cpoCount, revisionCount] = await Promise.all([
    prisma.customerPO.count({ where: { quotationId: id } }),
    prisma.quotation.count({ where: { parentQuotationId: id } }),
  ])
  if (cpoCount > 0) {
    throw new UserError(
      `This quotation has ${cpoCount} customer PO${cpoCount > 1 ? "s" : ""} against it. Delete those first.`,
    )
  }
  if (revisionCount > 0) {
    throw new UserError("This quotation has later revisions. Delete the revisions first.")
  }
  await prisma.quotation.delete({ where: { id } })
}

export async function deleteCpoCore(id: string): Promise<void> {
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
}

export async function deleteSpoCore(id: string): Promise<void> {
  const spo = await prisma.supplierPO.findUnique({ where: { id }, select: { status: true } })
  if (!spo) throw new UserError("Supplier PO not found.")
  if (!EDITABLE_SPO_STATUSES.includes(spo.status)) {
    throw new UserError(`A supplier PO with status "${spo.status}" has already gone to the supplier and cannot be deleted.`)
  }
  await prisma.supplierPO.delete({ where: { id } })
}
