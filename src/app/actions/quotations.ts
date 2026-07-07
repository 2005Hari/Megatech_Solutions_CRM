"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { autoGenerateSPODraftFromCPO } from "./cpo"
import { QuotationType, ItemType } from "@prisma/client"

export async function uploadCustomerPO(quotationId: string, cpoRefNo: string, cpoDate: string, pdfFileName: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { items: true }
  })

  if (!quotation) throw new Error("Quotation not found")

  await prisma.quotation.update({
    where: { id: quotationId },
    data: { status: "Won" }
  })

  const cpo = await prisma.customerPO.create({
    data: {
      refNo: cpoRefNo,
      date: new Date(cpoDate),
      status: "Open",
      quotationId: quotation.id,
      customerId: quotation.customerId,
      pdfAttached: pdfFileName,
      items: {
        create: quotation.items.map(item => ({
          productName: item.productName,
          qty: item.qty,
          unit: item.unit,
          sellPrice: item.sellPrice
        }))
      }
    }
  })

  await autoGenerateSPODraftFromCPO(cpo.id)

  revalidatePath("/")
  revalidatePath("/quotations")
  revalidatePath("/cpo")
  revalidatePath("/spo")
  
  return cpo
}

export type QuotationItemPayload = {
  id?: string
  type: ItemType
  brand: string
  productName: string
  qty: number
  unit: string
  sellPrice: number
  estimatedCost?: number
  laborCost?: number
  materialCost?: number
  transportCost?: number
  otherCost?: number
  order: number
}

export type QuotationSectionPayload = {
  id?: string
  name: string
  order: number
  items: QuotationItemPayload[]
}

export type QuotationPayload = {
  customerId?: string
  refNo: string
  date: string
  validUntil?: string
  salutation: string
  subject: string
  type: QuotationType
  status?: string
  includeGst: boolean
  gstPct: number
  includeFreight: boolean
  freightAmount: number
  terms: string
  sections: QuotationSectionPayload[]
  items: QuotationItemPayload[] // Items not in any section
}

export async function createQuotation(data: QuotationPayload) {
  const quotation = await prisma.quotation.create({
    data: {
      customerId: data.customerId || null,
      refNo: data.refNo,
      date: new Date(data.date),
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      status: data.status || "Draft",
      salutation: data.salutation,
      subject: data.subject,
      type: data.type,
      includeGst: data.includeGst,
      gstPct: data.gstPct,
      includeFreight: data.includeFreight,
      freightAmount: data.freightAmount,
      terms: data.terms,
      sections: {
        create: data.sections.map(sec => ({
          name: sec.name,
          order: sec.order,
          items: {
            create: sec.items.map(i => ({
              type: i.type,
              order: i.order,
              brand: i.brand,
              productName: i.productName,
              qty: i.qty,
              unit: i.unit,
              sellPrice: i.sellPrice,
              estimatedCost: i.estimatedCost,
              laborCost: i.laborCost,
              materialCost: i.materialCost,
              transportCost: i.transportCost,
              otherCost: i.otherCost
            }))
          }
        }))
      },
      items: {
        create: data.items.map(i => ({
          type: i.type,
          order: i.order,
          brand: i.brand,
          productName: i.productName,
          qty: i.qty,
          unit: i.unit,
          sellPrice: i.sellPrice,
          estimatedCost: i.estimatedCost,
          laborCost: i.laborCost,
          materialCost: i.materialCost,
          transportCost: i.transportCost,
          otherCost: i.otherCost
        }))
      }
    }
  })

  revalidatePath("/quotations")
  return quotation
}

export async function updateQuotation(id: string, data: QuotationPayload) {
  await prisma.$transaction(async (tx) => {
    // Update main fields
    await tx.quotation.update({
      where: { id },
      data: {
        customerId: data.customerId || null,
        refNo: data.refNo,
        date: new Date(data.date),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        salutation: data.salutation,
        subject: data.subject,
        type: data.type,
        status: data.status,
        includeGst: data.includeGst,
        gstPct: data.gstPct,
        includeFreight: data.includeFreight,
        freightAmount: data.freightAmount,
        terms: data.terms,
      }
    })

    // To cleanly sync sections and items, we delete all existing sections and items and recreate them.
    // In a real app we might want to do upserts to preserve IDs for other relationships, but items here don't have downstream references until converted to PO.
    await tx.quotationSection.deleteMany({ where: { quotationId: id } })
    await tx.quotationItem.deleteMany({ where: { quotationId: id } })

    for (const sec of data.sections) {
      await tx.quotationSection.create({
        data: {
          quotationId: id,
          name: sec.name,
          order: sec.order,
          items: {
            create: sec.items.map(i => ({
              type: i.type,
              order: i.order,
              brand: i.brand,
              productName: i.productName,
              qty: i.qty,
              unit: i.unit,
              sellPrice: i.sellPrice,
              estimatedCost: i.estimatedCost,
              laborCost: i.laborCost,
              materialCost: i.materialCost,
              transportCost: i.transportCost,
              otherCost: i.otherCost
            }))
          }
        }
      })
    }

    if (data.items.length > 0) {
      await tx.quotation.update({
        where: { id },
        data: {
          items: {
            create: data.items.map(i => ({
              type: i.type,
              order: i.order,
              brand: i.brand,
              productName: i.productName,
              qty: i.qty,
              unit: i.unit,
              sellPrice: i.sellPrice,
              estimatedCost: i.estimatedCost,
              laborCost: i.laborCost,
              materialCost: i.materialCost,
              transportCost: i.transportCost,
              otherCost: i.otherCost
            }))
          }
        }
      })
    }
  })

  revalidatePath("/quotations")
  revalidatePath(`/quotations/${id}`)
  revalidatePath("/")
}

export async function createQuotationRevision(id: string) {
  const original = await prisma.quotation.findUnique({
    where: { id },
    include: {
      sections: { include: { items: true } },
      items: { where: { sectionId: null } }
    }
  })

  if (!original) throw new Error("Original quotation not found")

  // Mark original as Revised
  await prisma.quotation.update({
    where: { id },
    data: { status: "Revised" }
  })

  const newRevisionNumber = original.revision + 1
  const newRefNo = original.refNo.includes(" Rev-") 
    ? original.refNo.replace(/ Rev-\d+$/, ` Rev-${newRevisionNumber}`) 
    : `${original.refNo} Rev-${newRevisionNumber}`

  // Create new revision
  const newQuotation = await prisma.quotation.create({
    data: {
      customerId: original.customerId,
      refNo: newRefNo,
      date: new Date(),
      validUntil: original.validUntil,
      status: "Draft",
      salutation: original.salutation,
      subject: original.subject,
      type: original.type,
      revision: newRevisionNumber,
      parentQuotationId: original.parentQuotationId || original.id,
      includeGst: original.includeGst,
      gstPct: original.gstPct,
      includeFreight: original.includeFreight,
      freightAmount: original.freightAmount,
      terms: original.terms,
      sections: {
        create: original.sections.map(sec => ({
          name: sec.name,
          order: sec.order,
          items: {
            create: sec.items.map(i => ({
              type: i.type,
              order: i.order,
              brand: i.brand,
              productName: i.productName,
              qty: i.qty,
              unit: i.unit,
              sellPrice: i.sellPrice,
              estimatedCost: i.estimatedCost,
              laborCost: i.laborCost,
              materialCost: i.materialCost,
              transportCost: i.transportCost,
              otherCost: i.otherCost
            }))
          }
        }))
      },
      items: {
        create: original.items.map(i => ({
          type: i.type,
          order: i.order,
          brand: i.brand,
          productName: i.productName,
          qty: i.qty,
          unit: i.unit,
          sellPrice: i.sellPrice,
          estimatedCost: i.estimatedCost,
          laborCost: i.laborCost,
          materialCost: i.materialCost,
          transportCost: i.transportCost,
          otherCost: i.otherCost
        }))
      }
    }
  })

  revalidatePath("/quotations")
  return newQuotation
}

export async function deleteQuotation(id: string) {
  await prisma.quotation.delete({
    where: { id }
  })

  revalidatePath("/quotations")
  revalidatePath("/")
}
