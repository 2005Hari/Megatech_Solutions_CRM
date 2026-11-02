import { describe, expect, it } from "vitest"
import {
  extractTextMessages,
  getWhatsAppConfig,
  verifyHandshake,
  verifyWebhookSignature,
} from "@/lib/whatsapp/client"

const SECRET = "test-app-secret"

async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body))
  const hex = Array.from(new Uint8Array(mac), b => b.toString(16).padStart(2, "0")).join("")
  return `sha256=${hex}`
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed body", async () => {
    const body = JSON.stringify({ hello: "world" })
    const sig = await sign(body, SECRET)
    expect(await verifyWebhookSignature(body, sig, SECRET)).toBe(true)
  })

  it("rejects a tampered body (classic webhook attack: edit the payload, keep the header)", async () => {
    const original = JSON.stringify({ messages: [{ from: "111", text: { body: "hi" } }] })
    const sig = await sign(original, SECRET)
    const tampered = JSON.stringify({ messages: [{ from: "999", text: { body: "hi" } }] })
    expect(await verifyWebhookSignature(tampered, sig, SECRET)).toBe(false)
  })

  it("rejects the wrong secret, missing header, and malformed header", async () => {
    const body = "{}"
    const sig = await sign(body, SECRET)
    expect(await verifyWebhookSignature(body, sig, "wrong-secret")).toBe(false)
    expect(await verifyWebhookSignature(body, null, SECRET)).toBe(false)
    expect(await verifyWebhookSignature(body, "not-even-hex", SECRET)).toBe(false)
    expect(await verifyWebhookSignature(body, "md5=deadbeef", SECRET)).toBe(false)
  })
})

describe("verifyHandshake", () => {
  it("returns the challenge only when mode and token both match", () => {
    expect(verifyHandshake({ mode: "subscribe", token: "t", challenge: "123" }, "t")).toBe("123")
  })

  it("refuses a wrong token, wrong mode, or missing challenge", () => {
    expect(verifyHandshake({ mode: "subscribe", token: "wrong", challenge: "123" }, "t")).toBeNull()
    expect(verifyHandshake({ mode: "unsubscribe", token: "t", challenge: "123" }, "t")).toBeNull()
    expect(verifyHandshake({ mode: "subscribe", token: "t", challenge: null }, "t")).toBeNull()
  })
})

describe("getWhatsAppConfig", () => {
  it("is null unless all four variables are set", () => {
    expect(getWhatsAppConfig({})).toBeNull()
    expect(
      getWhatsAppConfig({ WHATSAPP_ACCESS_TOKEN: "a", WHATSAPP_PHONE_NUMBER_ID: "b", WHATSAPP_APP_SECRET: "c" }),
    ).toBeNull()
    expect(
      getWhatsAppConfig({
        WHATSAPP_ACCESS_TOKEN: "a",
        WHATSAPP_PHONE_NUMBER_ID: "b",
        WHATSAPP_APP_SECRET: "c",
        WHATSAPP_VERIFY_TOKEN: "d",
      }),
    ).toEqual({ accessToken: "a", phoneNumberId: "b", appSecret: "c", verifyToken: "d" })
  })
})

describe("extractTextMessages", () => {
  it("pulls text messages out of a realistic Cloud API payload", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ type: "text", from: "919876543210", id: "wamid.1", text: { body: "2 dome cameras" } }],
              },
            },
          ],
        },
      ],
    }
    expect(extractTextMessages(payload)).toEqual([{ from: "919876543210", text: "2 dome cameras", messageId: "wamid.1" }])
  })

  it("ignores delivery-status callbacks and non-text messages", () => {
    const statusOnly = { entry: [{ changes: [{ value: { statuses: [{ status: "delivered" }] } }] }] }
    expect(extractTextMessages(statusOnly)).toEqual([])

    const imageMessage = { entry: [{ changes: [{ value: { messages: [{ type: "image", from: "1", id: "x" }] } }] }] }
    expect(extractTextMessages(imageMessage)).toEqual([])
  })

  it("is defensive against malformed or unexpected shapes", () => {
    expect(extractTextMessages(null)).toEqual([])
    expect(extractTextMessages({})).toEqual([])
    expect(extractTextMessages({ entry: "not an array" })).toEqual([])
    expect(extractTextMessages({ entry: [{ changes: [{ value: {} }] }] })).toEqual([])
  })
})
