import { round2 } from "./validation"

/**
 * Quotation money maths, shared by the builder, the details page, the PDF
 * preview and the list page so they can never disagree.
 */

export type PricedLine = {
  qty: number
  /** Selling price per unit */
  price: number
  /** Estimated cost per unit, if known */
  cost?: number | null
}

export type QuotationTotalsInput = {
  lines: PricedLine[]
  includeGst: boolean
  gstPct: number
  includeFreight: boolean
  freightAmount: number
}

export type QuotationTotals = {
  subtotal: number
  gstAmount: number
  freightAmount: number
  grandTotal: number
  expectedCost: number
  expectedProfit: number
  expectedMarginPct: number
}

export function lineTotal(qty: number, price: number): number {
  return round2((Number(qty) || 0) * (Number(price) || 0))
}

export function calcQuotationTotals(input: QuotationTotalsInput): QuotationTotals {
  const subtotal = round2(input.lines.reduce((s, l) => s + lineTotal(l.qty, l.price), 0))
  const gstAmount = input.includeGst ? round2(subtotal * (input.gstPct / 100)) : 0
  const freightAmount = input.includeFreight ? round2(input.freightAmount) : 0
  const grandTotal = round2(subtotal + gstAmount + freightAmount)

  const expectedCost = round2(input.lines.reduce((s, l) => s + lineTotal(l.qty, l.cost ?? 0), 0))
  const expectedProfit = round2(subtotal - expectedCost)
  const expectedMarginPct = subtotal > 0 ? (expectedProfit / subtotal) * 100 : 0

  return { subtotal, gstAmount, freightAmount, grandTotal, expectedCost, expectedProfit, expectedMarginPct }
}
