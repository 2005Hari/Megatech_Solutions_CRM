"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createUnit(data: { name: string; active: boolean }) {
  const unit = await prisma.unit.create({
    data
  })
  revalidatePath("/units")
  return unit
}

export async function updateUnit(id: string, data: { name: string; active: boolean }) {
  const unit = await prisma.unit.update({
    where: { id },
    data
  })
  revalidatePath("/units")
  return unit
}

export async function deleteUnit(id: string) {
  await prisma.unit.delete({ where: { id } })
  revalidatePath("/units")
}
