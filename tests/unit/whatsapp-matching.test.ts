import { describe, expect, it } from "vitest"
import { matchLines } from "@/lib/whatsapp/handle-requirement"
import { normalizeQty, type ExtractedLine } from "@/lib/whatsapp/extract-requirement"
import type { CatalogEntry } from "@/lib/whatsapp/catalog"
import { catalogKey } from "@/lib/catalog-key"
import { digitsOnly } from "@/lib/whatsapp/allowlist"

function entry(over: Partial<CatalogEntry> = {}): CatalogEntry {
  return {
    key: "cp plus|2mp dome camera",
    type: "PRODUCT",
    brand: "CP Plus",
    name: "2MP Dome Camera",
    unit: "Nos",
    sellPrice: 1200,
    estimatedCost: 800,
    promptLine: "cp plus|2mp dome camera => CP Plus 2MP Dome Camera, Rs.1200 per Nos",
    ...over,
  }
}

function line(over: Partial<ExtractedLine> = {}): ExtractedLine {
  return { description: "dome camera", qty: 1, unit: null, brand: null, catalogKey: null, ...over }
}

describe("matchLines", () => {
  it("matches a line whose catalogKey exists in the catalogue", () => {
    const byKey = new Map([["cp plus|2mp dome camera", entry()]])
    const { matched, unmatched } = matchLines([line({ catalogKey: "cp plus|2mp dome camera", qty: 3 })], byKey)
    expect(matched).toHaveLength(1)
    expect(matched[0].qty).toBe(3)
    expect(matched[0].entry.sellPrice).toBe(1200)
    expect(unmatched).toHaveLength(0)
  })

  it("is unmatched when the model says catalogKey is null", () => {
    const byKey = new Map([["cp plus|2mp dome camera", entry()]])
    const { matched, unmatched } = matchLines([line({ catalogKey: null, description: "100m cat6 cable" })], byKey)
    expect(matched).toHaveLength(0)
    expect(unmatched).toEqual([{ description: "100m cat6 cable", qty: 1, unit: null, brand: null }])
  })

  it("hallucination guard: a catalogKey the model invented, not in the catalogue, is treated as unmatched (never priced on trust alone)", () => {
    const byKey = new Map([["cp plus|2mp dome camera", entry()]])
    const { matched, unmatched } = matchLines(
      [line({ catalogKey: "cp plus|this-key-does-not-exist", description: "something" })],
      byKey,
    )
    expect(matched).toHaveLength(0)
    expect(unmatched).toHaveLength(1)
  })

  it("handles a mix of matched and unmatched lines independently", () => {
    const byKey = new Map([
      ["cp plus|2mp dome camera", entry()],
      ["hikvision|4ch nvr", entry({ key: "hikvision|4ch nvr", brand: "Hikvision", name: "4CH NVR", sellPrice: 3500 })],
    ])
    const { matched, unmatched } = matchLines(
      [
        line({ catalogKey: "cp plus|2mp dome camera" }),
        line({ catalogKey: null, description: "unknown widget" }),
        line({ catalogKey: "hikvision|4ch nvr" }),
      ],
      byKey,
    )
    expect(matched).toHaveLength(2)
    expect(unmatched).toHaveLength(1)
  })
})

describe("normalizeQty", () => {
  it("rounds to the nearest whole number", () => {
    expect(normalizeQty(2.4)).toBe(2)
    expect(normalizeQty(2.6)).toBe(3)
  })

  it("falls back to 1 for zero, negative, or non-finite input - never a quantity a customer didn't ask for", () => {
    expect(normalizeQty(0)).toBe(1)
    expect(normalizeQty(-5)).toBe(1)
    expect(normalizeQty(NaN)).toBe(1)
    expect(normalizeQty(Infinity)).toBe(1)
  })
})

describe("catalogKey", () => {
  it("is case-insensitive and whitespace-trimmed, brand first", () => {
    expect(catalogKey("CP Plus", "2MP Dome Camera")).toBe("cp plus|2mp dome camera")
    expect(catalogKey("  CP Plus  ", "  2MP Dome Camera  ")).toBe("cp plus|2mp dome camera")
  })

  it("omits the separator when there is no brand", () => {
    expect(catalogKey(null, "Installation Service")).toBe("installation service")
    expect(catalogKey(undefined, "Installation Service")).toBe("installation service")
    expect(catalogKey("", "Installation Service")).toBe("installation service")
  })
})

describe("digitsOnly", () => {
  it("strips everything but digits", () => {
    expect(digitsOnly("+91 98765-43210")).toBe("919876543210")
    expect(digitsOnly("919876543210")).toBe("919876543210")
  })
})
