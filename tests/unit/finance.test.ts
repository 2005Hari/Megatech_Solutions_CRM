import { describe, expect, it } from "vitest"
import { cpoFinance, isPriced, spoTotalCost } from "@/lib/finance"

const items = [{ qty: 10, sellPrice: 100, estimatedCost: 70 }]

describe("cpoFinance", () => {
  it("uses every supplier PO, not just the first", () => {
    const f = cpoFinance({
      items: [{ qty: 10, sellPrice: 100, estimatedCost: 70 }, { qty: 5, sellPrice: 200, estimatedCost: 150 }],
      supplierPOs: [{ items: [{ qty: 10, buyPrice: 60 }] }, { items: [{ qty: 5, buyPrice: 120 }] }],
    })
    expect(f.revenue).toBe(2000)
    expect(f.spoCount).toBe(2)
    expect(f.actualCost).toBe(1200)
    expect(f.actualProfit).toBe(800)
  })

  it("does not report profit while any supplier item is unpriced", () => {
    const f = cpoFinance({
      items,
      supplierPOs: [{ items: [{ qty: 10, buyPrice: null }] }],
    })
    expect(f.hasActual).toBe(false)
    expect(f.actualCost).toBeNull()
    expect(f.actualProfit).toBeNull()
  })

  it("treats legacy 0 buy prices as unpriced", () => {
    expect(isPriced(0)).toBe(false)
    expect(isPriced(null)).toBe(false)
    expect(isPriced(12.5)).toBe(true)
    expect(cpoFinance({ items, supplierPOs: [{ items: [{ qty: 10, buyPrice: 0 }] }] }).hasActual).toBe(false)
  })

  it("has no actuals without a supplier PO", () => {
    const f = cpoFinance({ items, supplierPOs: [] })
    expect(f.hasActual).toBe(false)
    expect(f.spoCount).toBe(0)
  })

  it("only reports expected profit when estimates exist for every line", () => {
    expect(cpoFinance({ items, supplierPOs: [] }).expectedProfit).toBe(300)
    expect(cpoFinance({ items: [{ qty: 1, sellPrice: 100, estimatedCost: null }], supplierPOs: [] }).expectedProfit).toBeNull()
    expect(
      cpoFinance({
        items: [{ qty: 1, sellPrice: 100, estimatedCost: 50 }, { qty: 1, sellPrice: 100, estimatedCost: null }],
        supplierPOs: [],
      }).expectedProfit,
    ).toBeNull()
  })

  it("spoTotalCost treats unpriced as 0 contribution", () => {
    expect(spoTotalCost([{ qty: 2, buyPrice: 50 }, { qty: 3, buyPrice: null }])).toBe(100)
  })
})
