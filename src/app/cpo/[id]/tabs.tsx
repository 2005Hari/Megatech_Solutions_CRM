"use client"

import { useState } from "react"
import { formatCurrency, formatDate } from "@/lib/utils"

export default function CpoTabs({ cpo, spo, totalRev }: any) {
  const [tab, setTab] = useState('details')

  return (
    <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
      <div className="border-b border-card-border px-6 flex gap-6 bg-muted/10">
        <button 
          onClick={() => setTab('details')}
          className={`py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'details' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Order Details
        </button>
        <button 
          onClick={() => setTab('margin')}
          className={`py-4 text-sm font-bold border-b-2 transition-colors ${tab === 'margin' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
        >
          Margin Analysis
        </button>
      </div>

      <div className="p-6">
        {tab === 'details' && (
          <div>
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Order Info</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">PO Date</span><span className="font-medium text-foreground">{formatDate(cpo.date)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Delivery Date</span><span className="font-medium text-foreground">{cpo.deliveryDate ? formatDate(cpo.deliveryDate) : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className="font-bold text-accent">{cpo.status}</span></div>
                  {cpo.pdfAttached && <div className="flex justify-between"><span className="text-muted-foreground">Document</span><span className="text-accent hover:text-accent/80 transition-colors underline cursor-pointer">{cpo.pdfAttached}</span></div>}
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Notes</h3>
                <p className="text-sm text-foreground bg-muted/30 p-3 rounded-lg border border-card-border">{cpo.notes || 'No notes attached.'}</p>
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
                {cpo.items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{item.productName}</td>
                    <td className="px-4 py-3 text-right text-foreground">{item.qty}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.unit || '—'}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(item.estimatedCost || 0)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatCurrency(item.sellPrice)}</td>
                    <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(item.qty * item.sellPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/10 border-t border-card-border">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right font-bold text-muted-foreground">Total Revenue</td>
                  <td className="px-4 py-3 text-right font-bold text-foreground">{formatCurrency(totalRev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {tab === 'margin' && (
          <div>
            <div>
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
                  {cpo.items.map((item: any) => {
                    const spoItem = spo ? spo.items.find((i: any) => i.cpoItemId === item.id || i.productName === item.productName) : null;
                    const expectedCost = item.estimatedCost || 0;
                    const expectedMarginAmt = item.sellPrice - expectedCost;
                    const expectedMarginPct = item.sellPrice > 0 ? (expectedMarginAmt / item.sellPrice) * 100 : 0;
                    
                    const actualCost = spoItem?.buyPrice;
                    const actualMarginAmt = actualCost ? item.sellPrice - actualCost : null;
                    const actualMarginPct = actualCost && item.sellPrice > 0 ? ((actualMarginAmt as number) / item.sellPrice) * 100 : null;
                    
                    let expColor = 'text-rose-500';
                    if (expectedMarginPct >= 20) expColor = 'text-emerald-500';
                    else if (expectedMarginPct >= 10) expColor = 'text-amber-500';
                    
                    let actColor = 'text-muted-foreground';
                    if (actualMarginPct !== null) {
                      if (actualMarginPct >= 20) actColor = 'text-emerald-500';
                      else if (actualMarginPct >= 10) actColor = 'text-amber-500';
                      else actColor = 'text-rose-500';
                    }

                    return (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-medium text-foreground">{item.productName}</td>
                        <td className="px-4 py-3 text-right text-foreground">{item.qty}</td>
                        <td className="px-4 py-3 text-right text-foreground">{formatCurrency(item.sellPrice)}</td>
                        
                        {/* Expected */}
                        <td className="px-4 py-3 text-right text-muted-foreground border-l border-card-border">{formatCurrency(expectedCost)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className={`font-bold ${expColor}`}>{formatCurrency(expectedMarginAmt * item.qty)}</div>
                          <div className={`text-[10px] font-bold ${expColor}`}>{expectedMarginPct.toFixed(1)}%</div>
                        </td>
                        
                        {/* Actual */}
                        <td className="px-4 py-3 text-right text-muted-foreground border-l border-card-border">{actualCost ? formatCurrency(actualCost) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          {actualMarginAmt !== null ? (
                            <>
                              <div className={`font-bold ${actColor}`}>{formatCurrency(actualMarginAmt * item.qty)}</div>
                              <div className={`text-[10px] font-bold ${actColor}`}>{actualMarginPct?.toFixed(1)}%</div>
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
