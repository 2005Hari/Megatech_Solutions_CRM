import type { Prisma } from "@prisma/client"
import { calcQuotationTotals, lineTotal } from "@/lib/totals"
import { cpoFinance, isPriced, spoTotalCost } from "@/lib/finance"
import { formatCurrency, formatDate } from "@/lib/utils"

/** Plain-text formatters for tool results. Claude reads this text directly and paraphrases it for the user. */

type QuotationWithLines = Prisma.QuotationGetPayload<{
  include: { customer: true; items: true; sections: { include: { items: true } } }
}>

export function formatQuotation(q: QuotationWithLines): string {
  const allItems = [...q.items.filter(i => !i.sectionId), ...q.sections.flatMap(s => s.items)]
  const totals = calcQuotationTotals({
    lines: allItems.map(i => ({ qty: i.qty, price: i.sellPrice, cost: i.estimatedCost })),
    includeGst: q.includeGst,
    gstPct: q.gstPct,
    includeFreight: q.includeFreight,
    freightAmount: q.freightAmount,
  })
  const lines = [
    `Quotation ${q.refNo} - status: ${q.status}`,
    `Customer: ${q.customer?.name ?? "Manual Entry (not linked)"}`,
    `Date: ${formatDate(q.date)}${q.validUntil ? `, valid until ${formatDate(q.validUntil)}` : ""}`,
    `Items (${allItems.length}):`,
    ...allItems.map(i => `  - ${i.brand ? i.brand + " " : ""}${i.productName} x${i.qty} @ ${formatCurrency(i.sellPrice)} = ${formatCurrency(lineTotal(i.qty, i.sellPrice))}`),
    `Subtotal: ${formatCurrency(totals.subtotal)}`,
    q.includeGst ? `GST (${q.gstPct}%): ${formatCurrency(totals.gstAmount)}` : null,
    q.includeFreight ? `Freight: ${formatCurrency(totals.freightAmount)}` : null,
    `Grand total: ${formatCurrency(totals.grandTotal)}`,
    `Expected profit: ${formatCurrency(totals.expectedProfit)} (${totals.expectedMarginPct.toFixed(1)}%)`,
  ].filter((l): l is string => l !== null)
  return lines.join("\n")
}

type CpoWithLines = Prisma.CustomerPOGetPayload<{
  include: { customer: true; items: true; supplierPOs: { include: { items: true } } }
}>

export function formatCustomerPo(cpo: CpoWithLines): string {
  const fin = cpoFinance(cpo)
  const lines = [
    `Customer PO ${cpo.refNo} - status: ${cpo.status}`,
    `Customer: ${cpo.customer?.name ?? "Manual Entry"}`,
    `Date: ${formatDate(cpo.date)}`,
    `Revenue: ${formatCurrency(fin.revenue)}`,
    fin.expectedProfit !== null
      ? `Expected profit: ${formatCurrency(fin.expectedProfit)} (${fin.expectedMarginPct?.toFixed(1)}%)`
      : `Expected profit: not available (no estimated costs recorded)`,
    fin.spoCount === 0
      ? `Supplier PO: none raised yet`
      : fin.hasActual
        ? `Actual cost: ${formatCurrency(fin.actualCost!)}, actual profit: ${formatCurrency(fin.actualProfit!)} (${fin.actualMarginPct?.toFixed(1)}%)`
        : `Supplier PO(s) raised (${fin.spoCount}) but not fully priced yet`,
    `Items (${cpo.items.length}):`,
    ...cpo.items.map(i => `  - ${i.productName} x${i.qty} @ ${formatCurrency(i.sellPrice)}`),
  ]
  return lines.join("\n")
}

type SpoWithLines = Prisma.SupplierPOGetPayload<{ include: { supplier: true; cpo: true; items: true } }>

export function formatSupplierPo(spo: SpoWithLines): string {
  const total = spoTotalCost(spo.items)
  const lines = [
    `Supplier PO ${spo.refNo} - status: ${spo.status}`,
    `Supplier: ${spo.supplier?.name ?? "Not assigned"}`,
    spo.cpo ? `Linked customer PO: ${spo.cpo.refNo}` : `Standalone PO`,
    `Date: ${formatDate(spo.date)}`,
    `Total cost: ${formatCurrency(total)}`,
    `Items (${spo.items.length}):`,
    ...spo.items.map(
      i => `  - ${i.productName} x${i.qty}${i.unit ? ` ${i.unit}` : ""} @ ${isPriced(i.buyPrice) ? formatCurrency(i.buyPrice) : "NOT PRICED"}`,
    ),
  ]
  return lines.join("\n")
}
