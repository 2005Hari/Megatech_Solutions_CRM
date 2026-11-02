"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { UserError } from "@/lib/errors"
import { dateFrom, oneOf, requiredId, requiredString } from "@/lib/validation"
import {
  parseQuotationPayload,
  writeQuotationBody,
  type QuotationPayload,
} from "@/lib/quotation-payload"
import { baseRef, nextQuotationRef } from "@/lib/refs"
import { createSupplierPODraft } from "@/lib/spo-draft"
import {
  CONVERTIBLE_QUOTATION_STATUSES,
  EDITABLE_QUOTATION_STATUSES,
  QUOTATION_STATUSES,
  REVISABLE_QUOTATION_STATUSES,
  canTransitionQuotation,
} from "@/lib/status"

function revalidateQuotations(id?: string) {
  revalidatePath("/")
  revalidatePath("/quotations")
  if (id) revalidatePath(`/quotations/${id}`)
}

async function assertCustomerExists(customerId: string | null) {
  if (!customerId) return
  const found = await prisma.customer.count({ where: { id: customerId } })
  if (!found) throw new UserError("The selected customer no longer exists.")
}

export async function createQuotation(
  payload: QuotationPayload,
): Promise<ActionResult<{ id: string; refNo: string }>> {
  return runAction(async () => {
    await requireAuth()
    const data = parseQuotationPayload(payload)
    await assertCustomerExists(data.customerId)

    const created = await prisma.$transaction(async tx => {
      const refNo = data.refNo ?? (await nextQuotationRef(tx))
      if (data.refNo && (await tx.quotation.count({ where: { refNo } })) > 0) {
        throw new UserError(`Quotation number ${refNo} is already in use.`)
      }

      const quotation = await tx.quotation.create({
        data: {
          refNo,
          customerId: data.customerId,
          customerAddress: data.customerAddress,
          date: data.date,
          validUntil: data.validUntil,
          status: "Draft",
          salutation: data.salutation,
          subject: data.subject,
          type: data.type,
          includeGst: data.includeGst,
          gstPct: data.gstPct,
          includeFreight: data.includeFreight,
          freightAmount: data.freightAmount,
          terms: data.terms,
        },
      })
      await writeQuotationBody(tx, quotation.id, data)
      return quotation
    })

    revalidateQuotations()
    return { id: created.id, refNo: created.refNo }
  })
}

export async function updateQuotation(id: string, payload: QuotationPayload): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Quotation")
    const data = parseQuotationPayload(payload)
    await assertCustomerExists(data.customerId)

    await prisma.$transaction(async tx => {
      const existing = await tx.quotation.findUnique({ where: { id }, select: { status: true, refNo: true } })
      if (!existing) throw new UserError("Quotation not found.")
      if (!EDITABLE_QUOTATION_STATUSES.includes(existing.status)) {
        throw new UserError(`A quotation with status "${existing.status}" can no longer be edited.`)
      }

      // The number stays as-is unless the user typed a different one.
      const refNo = data.refNo ?? existing.refNo
      if (refNo !== existing.refNo && (await tx.quotation.count({ where: { refNo } })) > 0) {
        throw new UserError(`Quotation number ${refNo} is already in use.`)
      }

      await tx.quotation.update({
        where: { id },
        data: {
          refNo,
          customerId: data.customerId,
          customerAddress: data.customerAddress,
          date: data.date,
          validUntil: data.validUntil,
          salutation: data.salutation,
          subject: data.subject,
          type: data.type,
          includeGst: data.includeGst,
          gstPct: data.gstPct,
          includeFreight: data.includeFreight,
          freightAmount: data.freightAmount,
          terms: data.terms,
        },
      })

      await tx.quotationItem.deleteMany({ where: { quotationId: id } })
      await tx.quotationSection.deleteMany({ where: { quotationId: id } })
      await writeQuotationBody(tx, id, data)
    })

    revalidateQuotations(id)
    return { id }
  })
}

export async function setQuotationStatus(id: string, status: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Quotation")
    const next = oneOf(status, QUOTATION_STATUSES, "Status")

    const existing = await prisma.quotation.findUnique({ where: { id }, select: { status: true } })
    if (!existing) throw new UserError("Quotation not found.")
    if (!canTransitionQuotation(existing.status, next)) {
      throw new UserError(`A quotation cannot move from "${existing.status}" to "${next}".`)
    }

    await prisma.quotation.update({ where: { id }, data: { status: next } })
    revalidateQuotations(id)
  })
}

export async function createQuotationRevision(id: string): Promise<ActionResult<{ id: string; refNo: string }>> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Quotation")

    const created = await prisma.$transaction(async tx => {
      const original = await tx.quotation.findUnique({
        where: { id },
        include: {
          sections: { include: { items: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
          items: { where: { sectionId: null }, orderBy: { order: "asc" } },
        },
      })
      if (!original) throw new UserError("Quotation not found.")
      if (!REVISABLE_QUOTATION_STATUSES.includes(original.status)) {
        throw new UserError(
          original.status === "Draft"
            ? "This quotation is still a draft - just edit it instead of creating a revision."
            : `A quotation with status "${original.status}" cannot be revised.`,
        )
      }

      // Revisions form a chain rooted at the first quotation.
      const rootId = original.parentQuotationId ?? original.id
      const chain = await tx.quotation.findMany({
        where: { OR: [{ id: rootId }, { parentQuotationId: rootId }] },
        select: { revision: true },
      })
      const latest = Math.max(...chain.map(c => c.revision))
      if (original.revision < latest) {
        throw new UserError("A newer revision of this quotation already exists. Revise the latest one instead.")
      }

      const revision = latest + 1
      const refNo = `${baseRef(original.refNo)} Rev-${revision}`
      if ((await tx.quotation.count({ where: { refNo } })) > 0) {
        throw new UserError(`Quotation number ${refNo} is already in use.`)
      }

      await tx.quotation.update({ where: { id }, data: { status: "Revised" } })

      const copy = await tx.quotation.create({
        data: {
          refNo,
          revision,
          parentQuotationId: rootId,
          customerId: original.customerId,
          customerAddress: original.customerAddress,
          date: new Date(),
          validUntil: original.validUntil,
          status: "Draft",
          salutation: original.salutation,
          subject: original.subject,
          type: original.type,
          includeGst: original.includeGst,
          gstPct: original.gstPct,
          includeFreight: original.includeFreight,
          freightAmount: original.freightAmount,
          terms: original.terms,
        },
      })

      const toValid = (i: (typeof original.items)[number]) => ({
        type: i.type,
        brand: i.brand,
        productName: i.productName,
        qty: i.qty,
        unit: i.unit ?? "Nos",
        sellPrice: i.sellPrice,
        estimatedCost: i.estimatedCost,
        laborCost: i.laborCost,
        materialCost: i.materialCost,
        transportCost: i.transportCost,
        otherCost: i.otherCost,
      })
      await writeQuotationBody(tx, copy.id, {
        sections: original.sections.map(s => ({ name: s.name, order: s.order, items: s.items.map(toValid) })),
        items: original.items.map(toValid),
      })
      return copy
    })

    revalidateQuotations(id)
    return { id: created.id, refNo: created.refNo }
  })
}

export async function deleteQuotation(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Quotation")

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
    revalidateQuotations()
  })
}

/**
 * Record a customer PO against a quotation: creates the CPO (copying the
 * quotation lines, including estimated costs), marks the quotation Won and
 * raises the draft supplier PO - all or nothing.
 */
export async function uploadCustomerPO(
  quotationId: string,
  cpoRefNo: string,
  cpoDate: string,
  pdfFileName: string,
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuth()
    requiredId(quotationId, "Quotation")
    const refNo = requiredString(cpoRefNo, "CPO reference number", 100)
    const date = dateFrom(cpoDate, "CPO date")
    const pdf = requiredString(pdfFileName, "CPO document", 255)

    const cpo = await prisma.$transaction(async tx => {
      const quotation = await tx.quotation.findUnique({
        where: { id: quotationId },
        include: { items: { orderBy: { order: "asc" } } },
      })
      if (!quotation) throw new UserError("Quotation not found.")
      if (!CONVERTIBLE_QUOTATION_STATUSES.includes(quotation.status)) {
        throw new UserError(`A quotation with status "${quotation.status}" cannot be converted to a customer PO.`)
      }
      if (quotation.items.length === 0) throw new UserError("This quotation has no line items.")
      if ((await tx.customerPO.count({ where: { refNo } })) > 0) {
        throw new UserError(`Customer PO ${refNo} already exists.`)
      }

      const created = await tx.customerPO.create({
        data: {
          refNo,
          date,
          status: "Open",
          quotationId: quotation.id,
          customerId: quotation.customerId,
          pdfAttached: pdf,
          items: {
            create: quotation.items.map(item => ({
              productName: item.productName,
              qty: item.qty,
              unit: item.unit,
              sellPrice: item.sellPrice,
              estimatedCost: item.estimatedCost,
            })),
          },
        },
      })

      if (quotation.status !== "Won") {
        await tx.quotation.update({ where: { id: quotation.id }, data: { status: "Won" } })
      }
      await createSupplierPODraft(tx, created.id)
      return created
    })

    revalidatePath("/")
    revalidatePath("/quotations")
    revalidatePath(`/quotations/${quotationId}`)
    revalidatePath("/cpo")
    revalidatePath("/spo")
    return { id: cpo.id }
  })
}
