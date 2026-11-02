import { describe, expect, it } from "vitest"
import { calcQuotationTotals, lineTotal } from "@/lib/totals"

const base = { includeGst: true, gstPct: 18, includeFreight: true, freightAmount: 500 }

describe("calcQuotationTotals", () => {
  it("adds GST and freight to the subtotal", () => {
    const t = calcQuotationTotals({ ...base, lines: [{ qty: 2, price: 1000 }, { qty: 1, price: 500 }] })
    expect(t.subtotal).toBe(2500)
    expect(t.gstAmount).toBe(450)
    expect(t.freightAmount).toBe(500)
    expect(t.grandTotal).toBe(3450)
  })

  it("treats a 0% GST rate as zero tax (not a fallback to 18%)", () => {
    const t = calcQuotationTotals({ ...base, gstPct: 0, lines: [{ qty: 1, price: 1000 }] })
    expect(t.gstAmount).toBe(0)
    expect(t.grandTotal).toBe(1500)
  })

  it("ignores GST/freight when switched off", () => {
    const t = calcQuotationTotals({
      lines: [{ qty: 1, price: 1000 }],
      includeGst: false,
      gstPct: 18,
      includeFreight: false,
      freightAmount: 999,
    })
    expect(t.grandTotal).toBe(1000)
  })

  it("computes expected profit/margin from per-unit estimated costs", () => {
    const t = calcQuotationTotals({ ...base, lines: [{ qty: 10, price: 100, cost: 70 }] })
    expect(t.expectedCost).toBe(700)
    expect(t.expectedProfit).toBe(300)
    expect(t.expectedMarginPct).toBeCloseTo(30)
  })

  it("is safe with no lines / NaN inputs", () => {
    expect(calcQuotationTotals({ ...base, lines: [] }).subtotal).toBe(0)
    expect(calcQuotationTotals({ ...base, lines: [] }).expectedMarginPct).toBe(0)
    expect(lineTotal(NaN, 5)).toBe(0)
  })

  it("avoids float drift", () => {
    expect(calcQuotationTotals({ ...base, includeGst: false, includeFreight: false, lines: [{ qty: 3, price: 0.1 }] }).subtotal).toBe(0.3)
  })
})
