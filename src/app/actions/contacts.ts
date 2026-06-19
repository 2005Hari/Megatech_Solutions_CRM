"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createContact(
  type: "customer" | "supplier",
  data: { name: string; contactDetails?: string }
) {
  if (!data.name.trim()) {
    throw new Error("Name is required")
  }

  if (type === "customer") {
    const customer = await prisma.customer.create({
      data: {
        name: data.name.trim(),
        contactDetails: data.contactDetails?.trim() || null
      }
    })
    revalidatePath("/contacts")
    revalidatePath("/quotations/new")
    return customer
  } else {
    const supplier = await prisma.supplier.create({
      data: {
        name: data.name.trim(),
        contactDetails: data.contactDetails?.trim() || null
      }
    })
    revalidatePath("/contacts")
    revalidatePath("/spo")
    return supplier
  }
}

export async function updateContact(
  type: "customer" | "supplier",
  id: string,
  data: { name: string; contactDetails?: string }
) {
  if (!data.name.trim()) {
    throw new Error("Name is required")
  }

  if (type === "customer") {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name.trim(),
        contactDetails: data.contactDetails?.trim() || null
      }
    })
    revalidatePath("/contacts")
    revalidatePath(`/contacts/customer/${id}`)
    revalidatePath("/quotations")
    revalidatePath("/cpo")
    return customer
  } else {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: data.name.trim(),
        contactDetails: data.contactDetails?.trim() || null
      }
    })
    revalidatePath("/contacts")
    revalidatePath(`/contacts/supplier/${id}`)
    revalidatePath("/spo")
    return supplier
  }
}

export async function deleteContact(type: "customer" | "supplier", id: string) {
  if (type === "customer") {
    // Check if customer has quotations
    const quotationsCount = await prisma.quotation.count({
      where: { customerId: id }
    })
    if (quotationsCount > 0) {
      throw new Error("Cannot delete customer. They have linked quotations in the system.")
    }

    // Check if customer has POs
    const cpoCount = await prisma.customerPO.count({
      where: { customerId: id }
    })
    if (cpoCount > 0) {
      throw new Error("Cannot delete customer. They have linked customer purchase orders.")
    }

    await prisma.customer.delete({
      where: { id }
    })
  } else {
    // Check if supplier has POs
    const spoCount = await prisma.supplierPO.count({
      where: { supplierId: id }
    })
    if (spoCount > 0) {
      throw new Error("Cannot delete supplier. They have active supplier purchase orders.")
    }

    await prisma.supplier.delete({
      where: { id }
    })
  }

  revalidatePath("/contacts")
}
