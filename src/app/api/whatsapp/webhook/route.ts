import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  extractTextMessages,
  getWhatsAppConfig,
  sendWhatsAppText,
  verifyHandshake,
  verifyWebhookSignature,
} from "@/lib/whatsapp/client"
import { isAllowedSender } from "@/lib/whatsapp/allowlist"
import { handleWhatsAppRequirement } from "@/lib/whatsapp/handle-requirement"

export const dynamic = "force-dynamic"

/** Meta's one-time webhook verification handshake, run when you register the callback URL. */
export async function GET(request: NextRequest) {
  const config = getWhatsAppConfig()
  if (!config) return new NextResponse("WhatsApp is not configured.", { status: 503 })

  const { searchParams } = request.nextUrl
  const challenge = verifyHandshake(
    {
      mode: searchParams.get("hub.mode"),
      token: searchParams.get("hub.verify_token"),
      challenge: searchParams.get("hub.challenge"),
    },
    config.verifyToken,
  )
  if (!challenge) return new NextResponse("Forbidden", { status: 403 })
  return new NextResponse(challenge, { status: 200 })
}

/**
 * Inbound WhatsApp messages. There is no human review before a quotation is
 * created, so every request is verified twice before anything runs: the
 * HMAC signature (proves the request really came from Meta) and the sender
 * allowlist (proves it is one of your staff, not whoever else discovers the
 * number). Always return 200 once the signature checks out, even on
 * failure, so Meta does not retry-storm a message that keeps erroring.
 */
export async function POST(request: NextRequest) {
  const config = getWhatsAppConfig()
  if (!config) return new NextResponse("WhatsApp is not configured.", { status: 503 })

  const rawBody = await request.text()
  const signatureOk = await verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret)
  if (!signatureOk) {
    return new NextResponse("Invalid signature", { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true }) // malformed body, nothing to do, ack anyway
  }

  const messages = extractTextMessages(payload)

  for (const message of messages) {
    try {
      const allowed = await isAllowedSender(message.from)
      if (!allowed) {
        await prisma.botRequirementLog.create({
          data: {
            fromPhone: message.from,
            rawMessage: message.text,
            status: "IGNORED_UNAUTHORIZED",
          },
        })
        continue // do not reply to an unrecognised number
      }

      const result = await handleWhatsAppRequirement({ fromPhone: message.from, rawMessage: message.text })
      await sendWhatsAppText(config, message.from, result.replyText)
    } catch (err) {
      console.error("[whatsapp webhook] failed to handle message:", err)
      // Best-effort failure reply so staff know to build the quotation by
      // hand instead of assuming the bot is still working on it.
      await sendWhatsAppText(
        config,
        message.from,
        "⚠️ Sorry, something went wrong processing that requirement. Please create the quotation manually in the app.",
      ).catch(sendErr => console.error("[whatsapp webhook] failed to send error reply:", sendErr))
    }
  }

  return NextResponse.json({ ok: true })
}
