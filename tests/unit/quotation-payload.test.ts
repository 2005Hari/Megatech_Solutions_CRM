import { describe, expect, it } from "vitest"
import { UserError } from "@/lib/errors"
import { parseQuotationPayload, type QuotationItemPayload, type QuotationPayload } from "@/lib/quotation-payload"
import { baseRef, formatRef } from "@/lib/refs"

const item = (over: Partial<QuotationItemPayload> = {}): QuotationItemPayload => ({
  type: "PRODUCT",
  productName: "Camera",
  qty: 2,
  sellPrice: 1000,
  ...over,
})

const payload = (over: Partial<QuotationPayload> = {}): QuotationPayload => ({
  date: "2026-11-02",
  salutation: "Dear Sir",
  subject: "CCTV",
  type: "PRODUCT",
  includeGst: true,
  gstPct: 18,
  includeFreight: false,
  freightAmount: 0,
  terms: "[]",
  sections: [],
  items: [item()],
  ...over,
})

describe("parseQuotationPayload", () => {
  it("accepts a valid payload and defaults the unit", () => {
    const v = parseQuotationPayload(payload())
    expect(v.items[0].unit).toBe("Nos")
    expect(v.refNo).toBeNull()
    expect(v.gstPct).toBe(18)
  })

  it("keeps a 0% GST rate", () => {
    expect(parseQuotationPayload(payload({ gstPct: 0 })).gstPct).toBe(0)
  })

  it("rejects fractional quantities (stored as integers)", () => {
    expect(() => parseQuotationPayload(payload({ items: [item({ qty: 1.5 })] }))).toThrow(/whole number/)
  })

  it("rejects negative / NaN prices and zero qty", () => {
    expect(() => parseQuotationPayload(payload({ items: [item({ sellPrice: -1 })] }))).toThrow(UserError)
    expect(() => parseQuotationPayload(payload({ items: [item({ sellPrice: NaN })] }))).toThrow(UserError)
    expect(() => parseQuotationPayload(payload({ items: [item({ qty: 0 })] }))).toThrow(UserError)
  })

  it("requires at least one line", () => {
    expect(() => parseQuotationPayload(payload({ items: [], sections: [] }))).toThrow(/at least one line/)
    expect(() => parseQuotationPayload(payload({ items: [], sections: [{ name: "A", items: [] }] }))).toThrow(/at least one line/)
  })

  it("counts lines inside sections", () => {
    const v = parseQuotationPayload(payload({ items: [], sections: [{ name: "Cameras", items: [item()] }] }))
    expect(v.sections[0].items).toHaveLength(1)
    expect(v.sections[0].order).toBe(0)
  })

  it("validates dates, gst, type and terms", () => {
    expect(() => parseQuotationPayload(payload({ date: "nope" }))).toThrow(/valid date/)
    expect(() => parseQuotationPayload(payload({ validUntil: "2026-01-01" }))).toThrow(/before the quotation date/)
    expect(() => parseQuotationPayload(payload({ gstPct: 120 }))).toThrow(UserError)
    expect(() => parseQuotationPayload(payload({ type: "BOGUS" as never }))).toThrow(UserError)
    expect(() => parseQuotationPayload(payload({ terms: "{not json" }))).toThrow(/Terms/)
    expect(() => parseQuotationPayload(payload({ terms: '[{"x":1}]' }))).toThrow(/Terms/)
  })

  it("rejects a bad item type", () => {
    expect(() => parseQuotationPayload(payload({ items: [item({ type: "GADGET" as never })] }))).toThrow(UserError)
  })

  it("blank refNo means auto-assign", () => {
    expect(parseQuotationPayload(payload({ refNo: "   " })).refNo).toBeNull()
    expect(parseQuotationPayload(payload({ refNo: " MTS-1 " })).refNo).toBe("MTS-1")
  })
})

describe("refs", () => {
  it("formats and strips revision suffixes", () => {
    expect(formatRef("MTS", 2026, 7, 3)).toBe("MTS-2026-007")
    expect(formatRef("SPO", 2026, 12, 4)).toBe("SPO-2026-0012")
    expect(baseRef("MTS-2026-007 Rev-2")).toBe("MTS-2026-007")
    expect(baseRef("MTS-2026-007")).toBe("MTS-2026-007")
  })
})
