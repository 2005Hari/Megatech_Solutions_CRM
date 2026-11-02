"use client"

import { useState } from "react"
import type { Prisma } from "@prisma/client"
import { formatCurrency, formatDate } from "@/lib/utils"
import { isPriced } from "@/lib/finance"
import { lineTotal } from "@/lib/totals"

type Cpo = Prisma.CustomerPOGetPayload<{ include: { items: true } }>
type Spo = Prisma.SupplierPOGetPayload<{ include: { items: true } }>

function tone(pct: number | null, good = 20, ok = 10) {
  if (pct === null) return "text-muted-foreground"
  if (pct >= good) return "text-emerald-600"
  if (pct >= ok) return "text-amber-600"
  return "text-rose-600"
}

export default function CpoTabs({ cpo, spos, totalRev }: { cpo: Cpo; spos: Spo[]; totalRev: number }) {
  const [tab, setTab] = useState<"details" | "margin">("details")
  const spoItems = spos.flatMap(s => s.items)

  const tabClass = (active: boolean) =>
    `py-4 text-sm font-bold border-b-2 transition-colors ${
      active ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    }`

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
      <div className="border-b border-card-border px-6 flex gap-6 bg-muted/10" role="tablist">
        <button role="tab" aria-selected={tab === "details"} onClick={() => setTab("details")} className={tabClass(tab === "details")}>
          Order Details
        </button>
        <button role="tab" aria-selected={tab === "margin"} onClick={() => setTab("margin")} className={tabClass(tab === "margin")}>
          Margin Analysis
        </button>
      </div>

      <div className="p-6">
        {tab === "details" && (
          <div>
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Order Info</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">PO Date</span><span className="font-medium text-foreground">{formatDate(cpo.date)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Delivery Date</span><span className="font-medium text-foreground">{cpo.deliveryDate ? formatDate(cpo.deliveryDate) : "—"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-bold text-accent">{cpo.status}</span></div>
                  {cpo.pdfAttached && (
                    <div className="flex justify-between"><span className="text-muted-foreground">Document</span><span className="text-foreground">{cpo.pdfAttached}</span></div>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Notes</h3>
                <p className="text-sm text-foreground bg-muted/30 p-3 rounded-lg border border-card-border whitespace-pre-wrap">{cpo.notes || "No notes attached."}</p>
              </div>
            </div>

            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Products</h3>
            <table className="w-full text-sm text-left border border-card-border rounded-lg overflow-hidden">
              <thead className="bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-card-border">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Est. Cost</th>
                  <th className="px-4 py-3 text-right">Sell Price</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {cpo.items.map(item => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground whitespace-pre-wrap">{item.productName}</td>
                    <td className="px-4 py-3 text-right text-foreground">{item.qty}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.unit || "—"}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{item.estimatedCost ? formatCurrency(item.estimatedCost) : "—"}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatCurrency(item.sellPrice)}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(lineTotal(item.qty, item.sellPrice))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/10 border-t border-card-border">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-muted-foreground">Total Revenue</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(totalRev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {tab === "margin" && (
          <table className="w-full text-sm text-left border border-card-border rounded-lg overflow-hidden">
            <thead className="bg-muted/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-card-border">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Selling Price</th>
                <th className="px-4 py-3 text-right border-x border-card-border">Est. Cost</th>
                <th className="px-4 py-3 text-right">Expected Margin</th>
                <th className="px-4 py-3 text-right border-x border-card-border">Actual Cost</th>
                <th className="px-4 py-3 text-right">Actual Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {cpo.items.map(item => {
                // Prefer the explicit link made when the draft SPO was raised.
                const spoItem = spoItems.find(i => i.cpoItemId === item.id) ?? spoItems.find(i => i.productName === item.productName)

                const hasEstimate = typeof item.estimatedCost === "number" && item.estimatedCost > 0
                const expectedPct = hasEstimate && item.sellPrice > 0 ? ((item.sellPrice - (item.estimatedCost as number)) / item.sellPrice) * 100 : null
                const expectedAmt = hasEstimate ? (item.sellPrice - (item.estimatedCost as number)) * item.qty : null

                const actualCost = spoItem && isPriced(spoItem.buyPrice) ? spoItem.buyPrice : null
                const actualPct = actualCost !== null && item.sellPrice > 0 ? ((item.sellPrice - actualCost) / item.sellPrice) * 100 : null
                const actualAmt = actualCost !== null ? (item.sellPrice - actualCost) * item.qty : null

                return (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground whitespace-pre-wrap">{item.productName}</td>
                    <td className="px-4 py-3 text-right text-foreground">{item.qty}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatCurrency(item.sellPrice)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground border-l border-card-border">{hasEstimate ? formatCurrency(item.estimatedCost as number) : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {expectedAmt !== null ? (
                        <>
                          <div className={`font-bold ${tone(expectedPct)}`}>{formatCurrency(expectedAmt)}</div>
                          <div className={`text-[10px] font-bold ${tone(expectedPct)}`}>{expectedPct?.toFixed(1)}%</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">No estimate</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground border-l border-card-border">{actualCost !== null ? formatCurrency(actualCost) : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {actualAmt !== null ? (
                        <>
                          <div className={`font-bold ${tone(actualPct)}`}>{formatCurrency(actualAmt)}</div>
                          <div className={`text-[10px] font-bold ${tone(actualPct)}`}>{actualPct?.toFixed(1)}%</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">Pending</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
