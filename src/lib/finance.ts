import { round2 } from "./validation"

/**
 * Order-level profitability.
 *
 * Rules that the old per-page copies got wrong:
 *  - A CPO can have several supplier POs; ALL of them count towards cost.
 *  - A supplier PO item with no buy price yet is "unpriced", not "free".
 *    Actual cost/profit is only reported once every item is priced, otherwise
 *    profit would be overstated by the missing costs.
 *  - Expected profit is only meaningful when estimated costs were recorded.
 */

export type CpoFinanceInput = {
  items: { qty: number; sellPrice: number; estimatedCost: number | null }[]
  supplierPOs: { items: { qty: number; buyPrice: number | null }[] }[]
}

export type CpoFinance = {
  revenue: number
  expectedCost: number
  /** True when every line has an estimated cost recorded. */
  hasExpected: boolean
  expectedProfit: number | null
  expectedMarginPct: number | null
  /** Sum of priced supplier items (may be partial - see `hasActual`). */
  pricedCost: number
  spoCount: number
  /** True when at least one SPO exists and every SPO item has a buy price. */
  hasActual: boolean
  actualCost: number | null
  actualProfit: number | null
  actualMarginPct: number | null
}

export function isPriced(buyPrice: number | null | undefined): buyPrice is number {
  // Older drafts stored 0 as a placeholder, so treat 0 as "not priced yet".
  return typeof buyPrice === "number" && buyPrice > 0
}

export function cpoFinance(cpo: CpoFinanceInput): CpoFinance {
  const revenue = round2(cpo.items.reduce((s, i) => s + i.qty * i.sellPrice, 0))

  const hasExpected =
    cpo.items.length > 0 && cpo.items.every(i => typeof i.estimatedCost === "number" && i.estimatedCost > 0)
  const expectedCost = round2(cpo.items.reduce((s, i) => s + i.qty * (i.estimatedCost ?? 0), 0))
  const expectedProfit = hasExpected ? round2(revenue - expectedCost) : null
  const expectedMarginPct = expectedProfit !== null && revenue > 0 ? (expectedProfit / revenue) * 100 : null

  const spoItems = cpo.supplierPOs.flatMap(s => s.items)
  const pricedCost = round2(spoItems.reduce((s, i) => s + (isPriced(i.buyPrice) ? i.qty * i.buyPrice : 0), 0))
  const hasActual = cpo.supplierPOs.length > 0 && spoItems.length > 0 && spoItems.every(i => isPriced(i.buyPrice))
  const actualCost = hasActual ? pricedCost : null
  const actualProfit = actualCost !== null ? round2(revenue - actualCost) : null
  const actualMarginPct = actualProfit !== null && revenue > 0 ? (actualProfit / revenue) * 100 : null

  return {
    revenue,
    expectedCost,
    hasExpected,
    expectedProfit,
    expectedMarginPct,
    pricedCost,
    spoCount: cpo.supplierPOs.length,
    hasActual,
    actualCost,
    actualProfit,
    actualMarginPct,
  }
}

export function spoTotalCost(items: { qty: number; buyPrice: number | null }[]): number {
  return round2(items.reduce((s, i) => s + i.qty * (i.buyPrice ?? 0), 0))
}
