import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import CpoTabs from "./tabs";

export default async function CustomerPODetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const cpo = await prisma.customerPO.findUnique({
    where: { id },
    include: { 
      items: true, 
      customer: true, 
      supplierPOs: { include: { items: true } } 
    }
  });

  if (!cpo) return <div className="p-8">Customer PO not found</div>;

  const spo = cpo.supplierPOs[0];
  const totalRev = cpo.items.reduce((sum, item) => sum + (item.qty * item.sellPrice), 0);
  const totalExpectedCost = cpo.items.reduce((sum, item) => sum + (item.qty * (item.estimatedCost || 0)), 0);
  const totalCost = spo ? spo.items.reduce((sum, item) => sum + (item.qty * (item.buyPrice || 0)), 0) : 0;
  
  const expectedProfit = totalRev - totalExpectedCost;
  const totalProfit = totalRev - totalCost;
  const expectedMargin = totalRev > 0 ? (expectedProfit / totalRev) * 100 : 0;
  const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="mb-2">
        <Link href="/cpo" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
          ← Back to Customer POs
        </Link>
      </div>
      
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{cpo.refNo}</h1>
          <p className="text-muted-foreground mt-1 font-medium">{cpo.customer?.name || "Manual Entry"}</p>
        </div>
        <div className="flex gap-3">
          {spo && <Link href={`/spo/${spo.id}`} className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground border border-card-border rounded-lg text-sm font-semibold transition-colors">View Supplier PO</Link>}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Revenue</div>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(totalRev)}</div>
        </div>
        <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Expected Profit</div>
          <div className={`text-2xl font-bold ${expectedProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {formatCurrency(expectedProfit)}
            <span className="text-xs font-normal text-muted-foreground ml-2">({expectedMargin.toFixed(1)}%)</span>
          </div>
        </div>
        <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Actual Cost</div>
          <div className="text-2xl font-bold text-foreground">{spo ? formatCurrency(totalCost) : 'Pending SPO'}</div>
        </div>
        <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Actual Profit</div>
          <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {spo ? formatCurrency(totalProfit) : '—'}
          </div>
        </div>
        <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Actual Margin %</div>
          <div className={`text-2xl font-bold ${avgMargin >= 15 ? 'text-emerald-500' : avgMargin >= 8 ? 'text-amber-500' : 'text-rose-500'}`}>
            {spo ? `${avgMargin.toFixed(1)}%` : '—'}
          </div>
        </div>
      </div>

      <CpoTabs cpo={cpo} spo={spo} totalRev={totalRev} />
    </div>
  );
}
