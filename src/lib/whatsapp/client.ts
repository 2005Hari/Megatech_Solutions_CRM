/**
 * WhatsApp Cloud API (Meta Graph API) client.
 *
 * Uses Web Crypto only (no `crypto` module import) so this runs the same way
 * whether the webhook route executes on the Node or Edge runtime.
 */

export type WhatsAppConfig = {
  accessToken: string
  phoneNumberId: string
  appSecret: string
  verifyToken: string
}

export function getWhatsAppConfig(
  env: Record<string, string | undefined> = process.env,
): WhatsAppConfig | null {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID
  const appSecret = env.WHATSAPP_APP_SECRET
  const verifyToken = env.WHATSAPP_VERIFY_TOKEN
  if (!accessToken || !phoneNumberId || !appSecret || !verifyToken) return null
  return { accessToken, phoneNumberId, appSecret, verifyToken }
}

const encoder = new TextEncoder()

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")
}

function timingSafeEqual(a: string, b: string): boolean {
  const ea = encoder.encode(a)
  const eb = encoder.encode(b)
  if (ea.length !== eb.length) return false
  let diff = 0
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i]
  return diff === 0
}

/**
 * Verify Meta's `X-Hub-Signature-256` header against the EXACT raw request
 * body. Must be computed from the raw bytes, before any JSON.parse - Meta
 * signs the bytes it sent, and re-serializing (even losslessly) can change
 * them. This is what stands between an inbound HTTP request and the bot
 * creating a quotation, so a wrong or missing signature must always be a
 * rejection, never a warning.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader) return false
  const [scheme, signature] = signatureHeader.split("=")
  if (scheme !== "sha256" || !signature) return false

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody))
  return timingSafeEqual(toHex(new Uint8Array(mac)), signature.toLowerCase())
}

/** Meta's webhook verification handshake (`GET` with `hub.*` query params). */
export function verifyHandshake(
  params: { mode: string | null; token: string | null; challenge: string | null },
  verifyToken: string,
): string | null {
  if (params.mode === "subscribe" && params.token === verifyToken && params.challenge) {
    return params.challenge
  }
  return null
}

export class WhatsAppSendError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = "WhatsAppSendError"
  }
}

/** Send a plain-text WhatsApp message via the Cloud API. */
export async function sendWhatsAppText(config: WhatsAppConfig, to: string, body: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/v22.0/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: true },
    }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new WhatsAppSendError(`WhatsApp send failed (${res.status}): ${text.slice(0, 500)}`, res.status)
  }
}

export type InboundTextMessage = { from: string; text: string; messageId: string }

/**
 * Pull the plain-text messages out of a Cloud API webhook payload. Returns
 * [] for delivery-status callbacks, non-text messages, and anything
 * malformed - those are not errors, just nothing for the bot to act on.
 */
export function extractTextMessages(payload: unknown): InboundTextMessage[] {
  const out: InboundTextMessage[] = []
  if (!payload || typeof payload !== "object") return out
  const entries = (payload as { entry?: unknown }).entry
  if (!Array.isArray(entries)) return out

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown })?.changes
    if (!Array.isArray(changes)) continue
    for (const change of changes) {
      const messages = (change as { value?: { messages?: unknown } })?.value?.messages
      if (!Array.isArray(messages)) continue
      for (const m of messages) {
        const msg = m as { type?: string; from?: string; id?: string; text?: { body?: string } }
        if (msg.type === "text" && typeof msg.from === "string" && typeof msg.text?.body === "string" && typeof msg.id === "string") {
          out.push({ from: msg.from, text: msg.text.body, messageId: msg.id })
        }
      }
    }
  }
  return out
}
