"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { UserError } from "@/lib/errors"
import { money, optionalMoney, optionalString, requiredId, requiredString } from "@/lib/validation"
import { catalogKey } from "@/lib/catalog-key"

export type ProductInput = {
  brand?: string
  name: string
  description?: string
  defaultUnit: string
  defaultRate: number
  defaultCost?: number
  sacCode?: string
  active: boolean
}

function parse(data: ProductInput) {
  const brand = optionalString(data?.brand, "Brand", 200)
  const name = requiredString(data?.name, "Product name", 300)
  return {
    brand,
    name,
    catalogKey: catalogKey(brand, name),
    description: optionalString(data?.description, "Description"),
    defaultUnit: requiredString(data?.defaultUnit, "Default unit", 50),
    defaultRate: money(data?.defaultRate, "Default rate"),
    defaultCost: optionalMoney(data?.defaultCost, "Default cost"),
    sacCode: optionalString(data?.sacCode, "HSN/SAC code", 20),
    active: Boolean(data?.active),
  }
}

function refresh() {
  revalidatePath("/settings")
  revalidatePath("/quotations/new")
}

export async function createProduct(data: ProductInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuth()
    const parsed = parse(data)
    if ((await prisma.product.count({ where: { catalogKey: parsed.catalogKey } })) > 0) {
      throw new UserError("A product with this brand and name already exists.")
    }
    const product = await prisma.product.create({ data: parsed, select: { id: true } })
    refresh()
    return product
  })
}

export async function updateProduct(id: string, data: ProductInput): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Product")
    const parsed = parse(data)
    const clash = await prisma.product.findUnique({ where: { catalogKey: parsed.catalogKey }, select: { id: true } })
    if (clash && clash.id !== id) {
      throw new UserError("Another product already uses this brand and name.")
    }
    await prisma.product.update({ where: { id }, data: parsed })
    refresh()
  })
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Product")
    await prisma.product.delete({ where: { id } })
    refresh()
  })
}
