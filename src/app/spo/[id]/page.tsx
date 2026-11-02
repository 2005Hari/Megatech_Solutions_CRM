import { notFound } from "next/navigation"
import Link from "next/link"
import { Edit, Printer } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils"
import { isPriced, spoTotalCost } from "@/lib/finance"
import { EDITABLE_SPO_STATUSES } from "@/lib/status"
import { lineTotal } from "@/lib/totals"
import { StatusBadge } from "@/components/ui/StatusBadge"
import DeleteSPOButton from "../DeleteSPOButton"
import SpoActions from "./SpoActions"

export const dynamic = "force-dynamic"

export default async function SupplierPODetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const spo = await prisma.supplierPO.findUnique({
    where: { id },
    include: {
      items: true,
      supplier: true,
      cpo: { include: { customer: true } },
      statusHistory: { orderBy: { createdAt: "desc" } },
    },
  })
  if (!spo) notFound()

  const totalCost = spoTotalCost(spo.items)
  const editable = EDITABLE_SPO_STATUSES.includes(spo.status)

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="mb-2">
        <Link href="/spo" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
          ← Back to Supplier POs
        </Link>
      </div>

      <div className="flex justify-between items-start mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{spo.refNo}</h1>
            <StatusBadge status={spo.status} />
          </div>
          <p className="text-muted-foreground mt-1 font-medium">
            {spo.supplier?.name || <span className="italic">Supplier Not Assigned</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {editable && (
            <Link
              href={`/spo/${spo.id}/edit`}
              className="px-4 py-2 border border-card-border hover:bg-muted text-foreground rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              <Edit size={16} /> Edit PO
            </Link>
          )}
          <SpoActions spoId={spo.id} status={spo.status} />
          <Link
            href={`/print/spo/${spo.id}`}
            target="_blank"
            className="px-4 py-2 bg-card border border-card-border hover:bg-muted text-foreground rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <Printer size={16} /> Print Document
          </Link>
          {editable && (
            <DeleteSPOButton
              spoId={spo.id}
              refNo={spo.refNo}
              redirectTo="/spo"
              className="px-4 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
              showText
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">
          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-card-border pb-3">Order Details</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div className="flex justify-between border-b border-card-border pb-2"><span className="text-muted-foreground">PO Date</span><span className="font-semibold text-foreground">{formatDate(spo.date)}</span></div>
              <div className="flex justify-between border-b border-card-border pb-2"><span className="text-muted-foreground">Delivery Date</span><span className="font-semibold text-foreground">{spo.deliveryDate ? formatDate(spo.deliveryDate) : "—"}</span></div>
              <div className="flex justify-between border-b border-card-border pb-2"><span className="text-muted-foreground">Status</span><span className="font-bold text-accent">{spo.status}</span></div>
              <div className="flex justify-between border-b border-card-border pb-2"><span className="text-muted-foreground">Linked CPO</span>
                {spo.cpo ? <Link href={`/cpo/${spo.cpo.id}`} className="text-accent hover:underline font-semibold">{spo.cpo.refNo}</Link> : "—"}
              </div>
            </div>
            {spo.notes && (
              <div className="mt-6 pt-4 border-t border-card-border">
                <span className="text-muted-foreground text-[10px] font-bold tracking-widest block mb-2 uppercase">PO Terms / Notes</span>
                <p className="text-sm text-foreground bg-muted/30 p-4 rounded-lg border border-card-border leading-relaxed font-medium whitespace-pre-wrap">{spo.notes}</p>
              </div>
            )}
          </div>

          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-card-border bg-muted/30">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Products &amp; Buying Prices</h3>
            </div>
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-card-border">
                <tr>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3 text-right">Qty</th>
                  <th className="px-6 py-3">Unit</th>
                  <th className="px-6 py-3 text-right">Buy Price</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {spo.items.map(item => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-semibold text-foreground whitespace-pre-wrap">{item.productName}</td>
                    <td className="px-6 py-4 text-right font-medium text-foreground">{item.qty}</td>
                    <td className="px-6 py-4 text-muted-foreground">{item.unit || "—"}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">
                      {isPriced(item.buyPrice) ? (
                        formatCurrency(item.buyPrice)
                      ) : (
                        <span className="text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Pending Price</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{formatCurrency(lineTotal(item.qty, item.buyPrice ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/10 border-t border-card-border">
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-right font-bold text-muted-foreground">Total Purchase Cost</td>
                  <td className="px-6 py-4 text-right font-bold text-xl text-accent">{formatCurrency(totalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="col-span-1 space-y-6">
          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-card-border pb-3">Status History</h3>
            <div className="space-y-4">
              {spo.statusHistory.map((history, idx) => (
                <div key={history.id} className="relative pl-6 pb-4 border-l-2 border-card-border last:border-transparent last:pb-0">
                  <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-card ${idx === 0 ? "bg-accent" : "bg-muted-foreground"}`}></div>
                  <div className="text-sm font-bold text-foreground">{history.status}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-medium">{formatDateTime(history.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
