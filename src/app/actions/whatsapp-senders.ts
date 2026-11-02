"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { UserError } from "@/lib/errors"
import { requiredId, requiredString } from "@/lib/validation"
import { digitsOnly } from "@/lib/whatsapp/allowlist"

export type WhatsAppSenderInput = { phoneNumber: string; label: string; active: boolean }

function parse(data: WhatsAppSenderInput) {
  const digits = digitsOnly(requiredString(data?.phoneNumber, "Phone number", 20))
  if (digits.length < 8 || digits.length > 15) {
    throw new UserError("Enter the number in international format, digits only (e.g. 919876543210).")
  }
  return {
    phoneNumber: digits,
    label: requiredString(data?.label, "Label", 100),
    active: Boolean(data?.active),
  }
}

function refresh() {
  revalidatePath("/settings")
}

export async function createWhatsAppSender(data: WhatsAppSenderInput): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    await requireAuth()
    const parsed = parse(data)
    if ((await prisma.whatsAppSender.count({ where: { phoneNumber: parsed.phoneNumber } })) > 0) {
      throw new UserError("This number is already in the allowlist.")
    }
    const sender = await prisma.whatsAppSender.create({ data: parsed, select: { id: true } })
    refresh()
    return sender
  })
}

export async function updateWhatsAppSender(id: string, data: WhatsAppSenderInput): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "WhatsApp sender")
    await prisma.whatsAppSender.update({ where: { id }, data: parse(data) })
    refresh()
  })
}

export async function deleteWhatsAppSender(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "WhatsApp sender")
    await prisma.whatsAppSender.delete({ where: { id } })
    refresh()
  })
}
