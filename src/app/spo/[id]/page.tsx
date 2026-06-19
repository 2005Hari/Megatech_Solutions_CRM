import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Printer, Edit, CheckCircle2, ArrowLeftRight, ClipboardCheck, Lock } from "lucide-react";
import { transitionSPOStatus } from "@/app/actions/spo";

export default async function SupplierPODetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const spo = await prisma.supplierPO.findUnique({
    where: { id },
    include: { 
      items: true, 
      supplier: true, 
      cpo: { include: { customer: true } },
      statusHistory: { orderBy: { createdAt: 'desc' } }
    }
  });

  if (!spo) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl">
          Supplier PO not found.
        </div>
        <div className="mt-4">
          <Link href="/spo" className="text-sm text-blue-600 hover:underline">← Back to Supplier POs</Link>
        </div>
      </div>
    );
  }

  const totalCost = spo.items.reduce((sum, item) => sum + (item.qty * (item.buyPrice || 0)), 0);

  // Workflow actions using bind for Server Actions
  const handleTransition = async (status: string) => {
    "use server"
    await transitionSPOStatus(id, status);
  };

  const isEditable = spo.status === "Draft" || spo.status === "Ready For Review";

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
            <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${
              spo.status === 'Draft' ? 'bg-muted/50 text-muted-foreground border border-card-border' :
              spo.status === 'Ready For Review' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
              spo.status === 'Sent' ? 'bg-accent/10 text-accent border border-accent/20' : 
              spo.status === 'Fully Received' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
              'bg-accent text-accent-foreground'
            }`}>
              {spo.status}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 font-medium">{spo.supplier?.name || <span className="italic">Supplier Not Assigned</span>}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Action buttons based on status */}
          {spo.status === "Draft" && (
            <>
              <Link href={`/spo/${spo.id}/edit`} className="px-4 py-2 border border-card-border hover:bg-muted text-foreground rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
                <Edit size={16} /> Edit PO
              </Link>
              <form action={handleTransition.bind(null, "Ready For Review")}>
                <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg text-sm font-semibold transition-colors cursor-pointer shadow-sm">
                  Mark Ready for Review
                </button>
              </form>
            </>
          )}

          {spo.status === "Ready For Review" && (
            <>
              <Link href={`/spo/${spo.id}/edit`} className="px-4 py-2 border border-card-border hover:bg-muted text-foreground rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors">
                <Edit size={16} /> Edit PO
              </Link>
              <form action={handleTransition.bind(null, "Sent")}>
                <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer">
                  Mark as Sent to Supplier
                </button>
              </form>
              <form action={handleTransition.bind(null, "Draft")}>
                <button type="submit" className="px-4 py-2 border border-card-border hover:bg-muted text-foreground rounded-lg text-sm font-medium transition-colors cursor-pointer">
                  Reset to Draft
                </button>
              </form>
            </>
          )}

          {spo.status === "Sent" && (
            <>
              <form action={handleTransition.bind(null, "Fully Received")}>
                <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2">
                  <CheckCircle2 size={16} /> Mark as Received
                </button>
              </form>
              <form action={handleTransition.bind(null, "Ready For Review")}>
                <button type="submit" className="px-4 py-2 border border-card-border hover:bg-muted text-foreground rounded-lg text-sm font-medium transition-colors cursor-pointer">
                  Back to Review
                </button>
              </form>
            </>
          )}

          {spo.status === "Fully Received" && (
            <form action={handleTransition.bind(null, "Closed")}>
              <button type="submit" className="px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center gap-2">
                <Lock size={16} /> Close PO
              </button>
            </form>
          )}

          <Link href={`/print/spo/${spo.id}`} target="_blank" className="px-4 py-2 bg-card border border-card-border hover:bg-muted text-foreground rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors">
            <Printer size={16} /> Print Document
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-6">
          <div className="bg-card border border-card-border rounded-xl shadow-sm p-6">
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-card-border pb-3">Order Details</h3>
            <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
              <div className="flex justify-between border-b border-card-border pb-2"><span className="text-muted-foreground">PO Date</span><span className="font-semibold text-foreground">{formatDate(spo.date)}</span></div>
              <div className="flex justify-between border-b border-card-border pb-2"><span className="text-muted-foreground">Delivery Date</span><span className="font-semibold text-foreground">{spo.deliveryDate ? formatDate(spo.deliveryDate) : '—'}</span></div>
              <div className="flex justify-between border-b border-card-border pb-2"><span className="text-muted-foreground">Status</span><span className="font-bold text-accent">{spo.status}</span></div>
              <div className="flex justify-between border-b border-card-border pb-2"><span className="text-muted-foreground">Linked CPO</span>
                {spo.cpo ? <Link href={`/cpo/${spo.cpo.id}`} className="text-accent hover:underline font-semibold">{spo.cpo.refNo}</Link> : '—'}
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
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Products & Buying Prices</h3>
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
                {spo.items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4 font-semibold text-foreground">{item.productName}</td>
                    <td className="px-6 py-4 text-right font-medium text-foreground">{item.qty}</td>
                    <td className="px-6 py-4 text-muted-foreground">{item.unit || '—'}</td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">
                      {item.buyPrice ? formatCurrency(item.buyPrice) : <span className="text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Pending Price</span>}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-foreground">{formatCurrency(item.qty * (item.buyPrice || 0))}</td>
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
                  <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-card ${idx === 0 ? 'bg-accent' : 'bg-muted-foreground'}`}></div>
                  <div className="text-sm font-bold text-foreground">{history.status}</div>
                  <div className="text-xs text-muted-foreground mt-1 font-medium">{new Date(history.createdAt).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
