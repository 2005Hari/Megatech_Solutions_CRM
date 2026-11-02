"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { money, optionalString, percent, requiredId, requiredString } from "@/lib/validation"

export type ServiceInput = {
  name: string
  description?: string
  defaultUnit: string
  defaultRate: number
  sacCode?: string
  gstPct: number
  active: boolean
}

function parse(data: ServiceInput) {
  return {
    name: requiredString(data?.name, "Service name", 200),
    description: optionalString(data?.description, "Description"),
    defaultUnit: requiredString(data?.defaultUnit, "Default unit", 50),
    defaultRate: money(data?.defaultRate, "Default rate"),
    sacCode: optionalString(data?.sacCode, "SAC code", 20),
    gstPct: percent(data?.gstPct, "GST %"),
    active: Boolean(data?.active),
  }
}

function refresh() {
  revalidatePath("/settings")
  revalidatePath("/quotations/new")
}

export async function createService(data: ServiceInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuth()
    const service = await prisma.service.create({ data: parse(data), select: { id: true } })
    refresh()
    return service
  })
}

export async function updateService(id: string, data: ServiceInput): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Service")
    await prisma.service.update({ where: { id }, data: parse(data) })
    refresh()
  })
}

export async function deleteService(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Service")
    await prisma.service.delete({ where: { id } })
    refresh()
  })
}
