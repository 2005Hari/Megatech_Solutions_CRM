import { prisma } from "@/lib/prisma"

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "")
}

/**
 * Only an active, allowlisted number may trigger the bot. This is the only
 * gate between an inbound WhatsApp message and a created quotation (the bot
 * has no in-app review step), so an unrecognised number is refused, not
 * treated as "ask a human later".
 */
export async function isAllowedSender(phoneNumber: string): Promise<boolean> {
  const sender = await prisma.whatsAppSender.findUnique({ where: { phoneNumber: digitsOnly(phoneNumber) } })
  return Boolean(sender?.active)
}

export { digitsOnly }
