"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createSupplierInline(name: string, contactDetails?: string) {
  if (!name) throw new Error("Supplier name is required")

  const supplier = await prisma.supplier.create({
    data: {
      name,
      contactDetails: contactDetails || null
    }
  })

  revalidatePath("/spo")
  return supplier
}

export async function transitionSPOStatus(spoId: string, newStatus: string) {
  const validStatuses = ["Draft", "Ready For Review", "Sent", "Partially Received", "Fully Received", "Closed"]
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`)
  }

  const spo = await prisma.supplierPO.update({
    where: { id: spoId },
    data: { 
      status: newStatus,
      statusHistory: {
        create: {
          status: newStatus
        }
      }
    }
  })

  // Also transition the Customer PO status to Fulfilled if the SPO is Fully Received
  if (newStatus === "Fully Received" && spo.cpoId) {
    await prisma.customerPO.update({
      where: { id: spo.cpoId },
      data: { status: "Fulfilled" }
    })
  }

  revalidatePath("/spo")
  revalidatePath(`/spo/${spoId}`)
  if (spo.cpoId) {
    revalidatePath(`/cpo/${spo.cpoId}`)
    revalidatePath("/cpo")
  }
  revalidatePath("/")

  return spo
}

export async function updateSupplierPO(
  spoId: string,
  data: {
    refNo: string
    date: string
    deliveryDate?: string
    notes?: string
    supplierId?: string
    items: { id?: string; productName: string; qty: number; unit?: string; buyPrice?: number }[]
  }
) {
  // Use transaction to ensure consistency
  await prisma.$transaction(async (tx) => {
    // 1. Update main SPO fields
    await tx.supplierPO.update({
      where: { id: spoId },
      data: {
        refNo: data.refNo,
        date: new Date(data.date),
        deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
        notes: data.notes || null,
        supplierId: data.supplierId || null,
      },
    })

    // 2. Sync items
    // Get existing items to know what to delete
    const existingDbItems = await tx.supplierPOItem.findMany({
      where: { spoId },
      select: { id: true }
    })

    const activeItemIds = data.items.map(i => i.id).filter(Boolean) as string[]
    const itemsToDelete = existingDbItems.filter(dbItem => !activeItemIds.includes(dbItem.id))

    // Delete removed items
    if (itemsToDelete.length > 0) {
      await tx.supplierPOItem.deleteMany({
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
        await tx.supplierPOItem.update({
          where: { id: item.id },
          data: {
            productName: item.productName,
            qty: item.qty,
            unit: item.unit || "nos",
            buyPrice: item.buyPrice || 0
          }
        })
      } else {
        await tx.supplierPOItem.create({
          data: {
            spoId,
            productName: item.productName,
            qty: item.qty,
            unit: item.unit || "nos",
            buyPrice: item.buyPrice || 0
          }
        })
      }
    }
  })

  revalidatePath("/spo")
  revalidatePath(`/spo/${spoId}`)
  revalidatePath("/")
  
  // Revalidate CPO path as buying prices update margins
  const spo = await prisma.supplierPO.findUnique({
    where: { id: spoId },
    select: { cpoId: true }
  })
  if (spo?.cpoId) {
    revalidatePath(`/cpo/${spo.cpoId}`)
    revalidatePath("/cpo")
  }
}
