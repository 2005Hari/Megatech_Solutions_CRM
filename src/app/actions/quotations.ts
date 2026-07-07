"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { autoGenerateSPODraftFromCPO } from "./cpo"

export async function uploadCustomerPO(quotationId: string, cpoRefNo: string, cpoDate: string, pdfFileName: string) {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: { items: true }
  })

  if (!quotation) throw new Error("Quotation not found")

  // Update quotation status
  await prisma.quotation.update({
    where: { id: quotationId },
    data: { status: "Won" }
  })

  // Create Customer PO
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

  // Auto Generate Supplier PO Draft
  await autoGenerateSPODraftFromCPO(cpo.id)

  revalidatePath("/")
  revalidatePath("/quotations")
  revalidatePath("/cpo")
  revalidatePath("/spo")
  
  return cpo
}

export async function createQuotation(data: {
  customerId?: string
  refNo: string
  date: string
  validUntil?: string
  salutation: string
  subject: string
  includeGst: boolean
  gstPct: number
  includeFreight: boolean
  freightAmount: number
  terms: string
  items: { brand: string, productName: string, qty: number, unit: string, sellPrice: number }[]
}) {
  const quotation = await prisma.quotation.create({
    data: {
      customerId: data.customerId || null,
      refNo: data.refNo,
      date: new Date(data.date),
      validUntil: data.validUntil ? new Date(data.validUntil) : null,
      status: "Pending",
      salutation: data.salutation,
      subject: data.subject,
      includeGst: data.includeGst,
      gstPct: data.gstPct,
      includeFreight: data.includeFreight,
      freightAmount: data.freightAmount,
      terms: data.terms,
      items: {
        create: data.items.map(i => ({
          brand: i.brand,
          productName: i.productName,
          qty: i.qty,
          unit: i.unit,
          sellPrice: i.sellPrice
        }))
      }
    }
  })

  revalidatePath("/quotations")
  
  return quotation
}

export async function updateQuotation(
  id: string,
  data: {
    customerId?: string
    refNo: string
    date: string
    validUntil?: string
    salutation: string
    subject: string
    includeGst: boolean
    gstPct: number
    includeFreight: boolean
    freightAmount: number
    terms: string
    items: { id?: string; brand: string; productName: string; qty: number; unit: string; sellPrice: number }[]
  }
) {
  // Use transaction to ensure consistency
  await prisma.$transaction(async (tx) => {
    // 1. Update main fields
    await tx.quotation.update({
      where: { id },
      data: {
        customerId: data.customerId || null,
        refNo: data.refNo,
        date: new Date(data.date),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        salutation: data.salutation,
        subject: data.subject,
        includeGst: data.includeGst,
        gstPct: data.gstPct,
        includeFreight: data.includeFreight,
        freightAmount: data.freightAmount,
        terms: data.terms,
      }
    })

    // 2. Sync items
    const existingDbItems = await tx.quotationItem.findMany({
      where: { quotationId: id },
      select: { id: true }
    })

    const activeItemIds = data.items.map(i => i.id).filter(Boolean) as string[]
    const itemsToDelete = existingDbItems.filter(dbItem => !activeItemIds.includes(dbItem.id))

    // Delete removed items
    if (itemsToDelete.length > 0) {
      await tx.quotationItem.deleteMany({
        where: {
          id: {
            in: itemsToDelete.map(i => i.id)
          }
        }
      })
    }

    // Update or Create current items
    for (const item of data.items) {
      if (item.id) {
        await tx.quotationItem.update({
          where: { id: item.id },
          data: {
            brand: item.brand,
            productName: item.productName,
            qty: item.qty,
            unit: item.unit,
            sellPrice: item.sellPrice
          }
        })
      } else {
        await tx.quotationItem.create({
          data: {
            quotationId: id,
            brand: item.brand,
            productName: item.productName,
            qty: item.qty,
            unit: item.unit,
            sellPrice: item.sellPrice
          }
        })
      }
    }
  })

  revalidatePath("/quotations")
  revalidatePath(`/quotations/${id}`)
  revalidatePath("/")
}
