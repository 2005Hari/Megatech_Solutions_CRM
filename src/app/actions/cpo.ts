"use server"

import { prisma } from "@/lib/prisma"

export async function autoGenerateSPODraftFromCPO(cpoId: string) {
  const cpo = await prisma.customerPO.findUnique({
    where: { id: cpoId },
    include: { items: true }
  })

  if (!cpo) throw new Error("CPO not found")

  // Generate a random SPO ref for draft
  const spoRef = `SPO-${new Date().getFullYear()}-DRAFT-${Math.floor(Math.random() * 1000)}`

  const spo = await prisma.supplierPO.create({
    data: {
      refNo: spoRef,
      date: new Date(),
      status: "Draft",
      cpoId: cpo.id,
      items: {
        create: cpo.items.map(item => ({
          productName: item.productName,
          qty: item.qty,
          unit: item.unit,
          buyPrice: 0, // Drafts don't have commercial info yet
          cpoItemId: item.id
        }))
      },
      statusHistory: {
        create: {
          status: "Draft"
        }
      }
    }
  })

  return spo
}
