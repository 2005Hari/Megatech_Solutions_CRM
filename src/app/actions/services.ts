"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createService(data: { name: string; description?: string; defaultUnit: string; defaultRate: number; sacCode?: string; gstPct: number; active: boolean }) {
  const service = await prisma.service.create({
    data
  })
  revalidatePath("/services")
  return service
}

export async function updateService(id: string, data: { name: string; description?: string; defaultUnit: string; defaultRate: number; sacCode?: string; gstPct: number; active: boolean }) {
  const service = await prisma.service.update({
    where: { id },
    data
  })
  revalidatePath("/services")
  return service
}

export async function deleteService(id: string) {
  await prisma.service.delete({ where: { id } })
  revalidatePath("/services")
}
