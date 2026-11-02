"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { UserError } from "@/lib/errors"
import { oneOf, optionalString, requiredId, requiredString } from "@/lib/validation"

type ContactType = "customer" | "supplier"
type ContactInput = { name: string; contactDetails?: string }
export type ContactRecord = { id: string; name: string; contactDetails: string | null }

const TYPES = ["customer", "supplier"] as const

function parse(data: ContactInput) {
  return {
    name: requiredString(data?.name, "Name", 200),
    contactDetails: optionalString(data?.contactDetails, "Contact details"),
  }
}

export async function createContact(type: ContactType, data: ContactInput): Promise<ActionResult<ContactRecord>> {
  return runAction(async () => {
    await requireAuth()
    const t = oneOf(type, TYPES, "Contact type")
    const input = parse(data)

    const record =
      t === "customer"
        ? await prisma.customer.create({ data: input, select: { id: true, name: true, contactDetails: true } })
        : await prisma.supplier.create({ data: input, select: { id: true, name: true, contactDetails: true } })

    revalidatePath("/contacts")
    return record
  })
}

export async function updateContact(
  type: ContactType,
  id: string,
  data: ContactInput,
): Promise<ActionResult<ContactRecord>> {
  return runAction(async () => {
    await requireAuth()
    const t = oneOf(type, TYPES, "Contact type")
    requiredId(id, "Contact")
    const input = parse(data)

    const record =
      t === "customer"
        ? await prisma.customer.update({ where: { id }, data: input, select: { id: true, name: true, contactDetails: true } })
        : await prisma.supplier.update({ where: { id }, data: input, select: { id: true, name: true, contactDetails: true } })

    revalidatePath("/contacts")
    revalidatePath(`/contacts/${t}/${id}`)
    return record
  })
}

export async function deleteContact(type: ContactType, id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    const t = oneOf(type, TYPES, "Contact type")
    requiredId(id, "Contact")

    if (t === "customer") {
      const [quotations, cpos] = await Promise.all([
        prisma.quotation.count({ where: { customerId: id } }),
        prisma.customerPO.count({ where: { customerId: id } }),
      ])
      if (quotations > 0) throw new UserError("Cannot delete this customer: they have linked quotations.")
      if (cpos > 0) throw new UserError("Cannot delete this customer: they have linked customer purchase orders.")
      await prisma.customer.delete({ where: { id } })
    } else {
      const spos = await prisma.supplierPO.count({ where: { supplierId: id } })
      if (spos > 0) throw new UserError("Cannot delete this supplier: they have linked supplier purchase orders.")
      await prisma.supplier.delete({ where: { id } })
    }

    revalidatePath("/contacts")
  })
}
