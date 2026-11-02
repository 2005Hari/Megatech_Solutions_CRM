"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { requiredId, requiredString } from "@/lib/validation"

export type UnitInput = { name: string; active: boolean }

function parse(data: UnitInput) {
  return { name: requiredString(data?.name, "Unit name", 50), active: Boolean(data?.active) }
}

function refresh() {
  revalidatePath("/settings")
  revalidatePath("/quotations/new")
}

export async function createUnit(data: UnitInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuth()
    const unit = await prisma.unit.create({ data: parse(data), select: { id: true } })
    refresh()
    return unit
  })
}

export async function updateUnit(id: string, data: UnitInput): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Unit")
    await prisma.unit.update({ where: { id }, data: parse(data) })
    refresh()
  })
}

export async function deleteUnit(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Unit")
    await prisma.unit.delete({ where: { id } })
    refresh()
  })
}
