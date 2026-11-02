"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { UserError } from "@/lib/errors"
import {
  dateFrom,
  oneOf,
  optionalDate,
  optionalMoney,
  optionalString,
  positiveInt,
  requiredId,
  requiredString,
} from "@/lib/validation"
import {
  EDITABLE_SPO_STATUSES,
  RECEIVED_SPO_STATUSES,
  SPO_STATUSES,
  canTransitionSpo,
} from "@/lib/status"
import { isPriced } from "@/lib/finance"

function revalidateSpo(spoId: string, cpoId?: string | null) {
  revalidatePath("/")
  revalidatePath("/spo")
  revalidatePath(`/spo/${spoId}`)
  revalidatePath("/margins")
  if (cpoId) {
    revalidatePath("/cpo")
    revalidatePath(`/cpo/${cpoId}`)
  }
}

export async function createSupplierInline(
  name: string,
  contactDetails?: string,
): Promise<ActionResult<{ id: string; name: string; contactDetails: string | null }>> {
  return runAction(async () => {
    await requireAuth()
    const supplier = await prisma.supplier.create({
      data: {
        name: requiredString(name, "Supplier name", 200),
        contactDetails: optionalString(contactDetails, "Contact details"),
      },
      select: { id: true, name: true, contactDetails: true },
    })
    revalidatePath("/contacts")
    return supplier
  })
}

export async function transitionSPOStatus(spoId: string, newStatus: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(spoId, "Supplier PO")
    const next = oneOf(newStatus, SPO_STATUSES, "Status")

    const cpoId = await prisma.$transaction(async tx => {
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

      // The customer order is only fulfilled once EVERY supplier PO raised
      // for it has been received.
      if (next === "Fully Received" && spo.cpoId) {
        const siblings = await tx.supplierPO.findMany({
          where: { cpoId: spo.cpoId },
          select: { status: true },
        })
        if (siblings.every(s => RECEIVED_SPO_STATUSES.includes(s.status))) {
          await tx.customerPO.update({ where: { id: spo.cpoId }, data: { status: "Fulfilled" } })
        }
      }

      return spo.cpoId
    })

    revalidateSpo(spoId, cpoId)
  })
}

export type SupplierPOUpdate = {
  refNo: string
  date: string
  deliveryDate?: string
  notes?: string
  supplierId?: string
  items: { id?: string; productName: string; qty: number; unit?: string; buyPrice?: number | null }[]
}

export async function updateSupplierPO(spoId: string, payload: SupplierPOUpdate): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(spoId, "Supplier PO")

    const refNo = requiredString(payload?.refNo, "SPO reference number", 100)
    const date = dateFrom(payload?.date, "PO date")
    const deliveryDate = optionalDate(payload?.deliveryDate, "Delivery date")
    const notes = optionalString(payload?.notes, "Notes")
    const supplierId = optionalString(payload?.supplierId, "Supplier", 100)

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      throw new UserError("Add at least one item.")
    }
    const items = payload.items.map((i, idx) => ({
      id: i.id,
      productName: requiredString(i.productName, `Item ${idx + 1} description`, 2000),
      qty: positiveInt(i.qty, `Item ${idx + 1} quantity`),
      unit: optionalString(i.unit, `Item ${idx + 1} unit`, 50) ?? "nos",
      buyPrice: optionalMoney(i.buyPrice, `Item ${idx + 1} buy price`),
    }))

    const cpoId = await prisma.$transaction(async tx => {
      const spo = await tx.supplierPO.findUnique({
        where: { id: spoId },
        include: { items: { select: { id: true } } },
      })
      if (!spo) throw new UserError("Supplier PO not found.")
      if (!EDITABLE_SPO_STATUSES.includes(spo.status)) {
        throw new UserError(`A supplier PO with status "${spo.status}" can no longer be edited.`)
      }

      if (supplierId && (await tx.supplier.count({ where: { id: supplierId } })) === 0) {
        throw new UserError("The selected supplier no longer exists.")
      }
      if (refNo !== spo.refNo && (await tx.supplierPO.count({ where: { refNo } })) > 0) {
        throw new UserError(`SPO number ${refNo} is already in use.`)
      }

      // Only items that really belong to this PO may be updated.
      const ownIds = new Set(spo.items.map(i => i.id))
      const keptIds = new Set<string>()
      for (const i of items) {
        if (i.id) {
          if (!ownIds.has(i.id)) throw new UserError("One of the items does not belong to this PO. Reload and retry.")
          keptIds.add(i.id)
        }
      }

      await tx.supplierPO.update({
        where: { id: spoId },
        data: { refNo, date, deliveryDate, notes, supplierId },
      })

      const removed = [...ownIds].filter(id => !keptIds.has(id))
      if (removed.length > 0) await tx.supplierPOItem.deleteMany({ where: { id: { in: removed } } })

      for (const i of items) {
        const data = { productName: i.productName, qty: i.qty, unit: i.unit, buyPrice: i.buyPrice }
        if (i.id) await tx.supplierPOItem.update({ where: { id: i.id }, data })
        else await tx.supplierPOItem.create({ data: { ...data, spoId } })
      }

      return spo.cpoId
    })

    revalidateSpo(spoId, cpoId)
  })
}

export async function deleteSPO(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Supplier PO")

    const spo = await prisma.supplierPO.findUnique({ where: { id }, select: { status: true, cpoId: true } })
    if (!spo) throw new UserError("Supplier PO not found.")
    if (!EDITABLE_SPO_STATUSES.includes(spo.status)) {
      throw new UserError(`A supplier PO with status "${spo.status}" has already gone to the supplier and cannot be deleted.`)
    }

    await prisma.supplierPO.delete({ where: { id } })
    revalidateSpo(id, spo.cpoId)
  })
}
