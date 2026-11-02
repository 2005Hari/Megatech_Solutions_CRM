import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { cpoFinance } from "@/lib/finance"
import { PAGE_SIZE, pageWindow, parsePage } from "@/lib/pagination"
import { formatCurrency } from "@/lib/utils"
import { round2 } from "@/lib/validation"
import { StatusBadge } from "@/components/ui/StatusBadge"
import Pagination from "@/components/ui/Pagination"

export const dynamic = "force-dynamic"

export default async function MarginsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams

  const cpos = await prisma.customerPO.findMany({
    where: { status: { not: "Cancelled" } },
    orderBy: { date: "desc" },
    select: {
      id: true,
      refNo: true,
      status: true,
      customer: { select: { name: true } },
      items: { select: { qty: true, sellPrice: true, estimatedCost: true } },
      supplierPOs: { select: { items: { select: { qty: true, buyPrice: true } } } },
    },
  })

  const rows = cpos
    .map(cpo => ({ cpo, fin: cpoFinance(cpo) }))
    // Fully priced orders first, best margin first; unpriced orders last.
    .sort((a, b) => (b.fin.actualMarginPct ?? -Infinity) - (a.fin.actualMarginPct ?? -Infinity))

  // Totals only cover orders whose supplier costs are complete.
  const priced = rows.filter(r => r.fin.hasActual)
  const totalRev = round2(priced.reduce((s, r) => s + r.fin.revenue, 0))
  const totalCost = round2(priced.reduce((s, r) => s + (r.fin.actualCost ?? 0), 0))
  const totalProfit = round2(totalRev - totalCost)
  const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0

  const { current, pages, skip, take } = pageWindow(parsePage(sp.page), rows.length, PAGE_SIZE)
  const pageRows = rows.slice(skip, skip + take)

  const card = "bg-card border border-card-border p-4 rounded-xl shadow-sm"
  const cardLabel = "text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2"

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Margin &amp; Profitability</h1>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className={card}>
          <div className={cardLabel}>Total Revenue</div>
          <div className="text-3xl font-bold text-accent mb-1">{formatCurrency(totalRev)}</div>
          <div className="text-xs text-muted-foreground">{priced.length} fully priced orders</div>
        </div>
        <div className={card}>
          <div className={cardLabel}>Total Cost</div>
          <div className="text-3xl font-bold text-foreground mb-1">{formatCurrency(totalCost)}</div>
          <div className="text-xs text-muted-foreground">Supplier cost</div>
        </div>
        <div className={card}>
          <div className={cardLabel}>Total Profit</div>
          <div className="text-3xl font-bold text-emerald-600 mb-1">{formatCurrency(totalProfit)}</div>
          <div className="text-xs text-muted-foreground">Revenue − Cost</div>
        </div>
        <div className={card}>
          <div className={cardLabel}>Avg Margin</div>
          <div className="text-3xl font-bold text-foreground mb-1">{avgMargin.toFixed(1)}%</div>
          <div className="text-xs text-muted-foreground">
            {rows.length - priced.length > 0 ? `${rows.length - priced.length} orders awaiting prices excluded` : "Across all orders"}
          </div>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-card-border">
          <h2 className="font-bold text-foreground">Order-wise Profitability</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Customer PO</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3 text-right">Revenue</th>
                <th className="px-5 py-3 text-right">Cost</th>
                <th className="px-5 py-3 text-right">Profit</th>
                <th className="px-5 py-3 text-right">Margin %</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-center text-muted-foreground">
                    No margin data yet
                  </td>
                </tr>
              ) : (
                pageRows.map(({ cpo, fin }) => (
                  <tr key={cpo.id} className="hover:bg-muted/30">
                    <td className="px-5 py-4 font-mono font-medium text-accent">
                      <Link href={`/cpo/${cpo.id}`}>{cpo.refNo}</Link>
                    </td>
                    <td className="px-5 py-4 font-medium text-foreground">{cpo.customer?.name || "Manual Entry"}</td>
                    <td className="px-5 py-4 text-right">{formatCurrency(fin.revenue)}</td>
                    <td className="px-5 py-4 text-right">
                      {fin.actualCost !== null ? (
                        formatCurrency(fin.actualCost)
                      ) : (
                        <span className="bg-muted text-muted-foreground px-2 py-1 rounded text-xs">
                          {fin.spoCount === 0 ? "No SPO" : "Awaiting prices"}
                        </span>
                      )}
                    </td>
                    <td className={`px-5 py-4 text-right font-bold ${fin.actualProfit !== null && fin.actualProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                      {fin.actualProfit !== null ? formatCurrency(fin.actualProfit) : "—"}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {fin.actualMarginPct !== null ? (
                        <span
                          className={`px-2 py-1 rounded-md text-xs font-bold ${
                            fin.actualMarginPct >= 20
                              ? "bg-emerald-500/10 text-emerald-700"
                              : fin.actualMarginPct >= 10
                                ? "bg-amber-500/10 text-amber-700"
                                : "bg-rose-500/10 text-rose-700"
                          }`}
                        >
                          {fin.actualMarginPct.toFixed(1)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={cpo.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination basePath="/margins" page={current} pages={pages} total={rows.length} />
      </div>
    </div>
  )
}
