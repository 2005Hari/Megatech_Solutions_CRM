import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { cpoFinance } from "@/lib/finance"
import { formatCurrency } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/StatusBadge"
import CpoTabs from "./tabs"
import DeleteCPOButton from "../DeleteCPOButton"

export const dynamic = "force-dynamic"

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border p-4 rounded-xl shadow-sm">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{label}</div>
      <div className="text-2xl font-bold">{children}</div>
    </div>
  )
}

const marginColor = (pct: number | null, good = 15, ok = 8) =>
  pct === null ? "text-muted-foreground" : pct >= good ? "text-emerald-600" : pct >= ok ? "text-amber-600" : "text-rose-600"

export default async function CustomerPODetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cpo = await prisma.customerPO.findUnique({
    where: { id },
    include: {
      items: true,
      customer: true,
      quotation: { select: { id: true, refNo: true } },
      supplierPOs: { include: { items: true }, orderBy: { date: "asc" } },
    },
  })
  if (!cpo) notFound()

  const fin = cpoFinance(cpo)

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="mb-2">
        <Link href="/cpo" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
          ← Back to Customer POs
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{cpo.refNo}</h1>
            <StatusBadge status={cpo.status} />
          </div>
          <p className="text-muted-foreground mt-1 font-medium">
            {cpo.customer?.name || "Manual Entry"}
            {cpo.quotation && (
              <>
                {" · from "}
                <Link href={`/quotations/${cpo.quotation.id}`} className="text-accent hover:underline">
                  {cpo.quotation.refNo}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          {cpo.supplierPOs.map(spo => (
            <Link
              key={spo.id}
              href={`/spo/${spo.id}`}
              className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground border border-card-border rounded-lg text-sm font-semibold transition-colors"
            >
              Supplier PO {spo.refNo}
            </Link>
          ))}
          <DeleteCPOButton
            cpoId={cpo.id}
            refNo={cpo.refNo}
            redirectTo="/cpo"
            className="px-4 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
            showText
          />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-8">
        <Kpi label="Revenue">{formatCurrency(fin.revenue)}</Kpi>
        <Kpi label="Expected Profit">
          {fin.expectedProfit === null ? (
            <span className="text-muted-foreground text-base font-semibold">No estimates</span>
          ) : (
            <span className={fin.expectedProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>
              {formatCurrency(fin.expectedProfit)}
              <span className="text-xs font-normal text-muted-foreground ml-2">({fin.expectedMarginPct?.toFixed(1)}%)</span>
            </span>
          )}
        </Kpi>
        <Kpi label="Actual Cost">
          {fin.actualCost !== null ? (
            formatCurrency(fin.actualCost)
          ) : (
            <span className="text-muted-foreground text-base font-semibold">
              {fin.spoCount === 0 ? "Pending SPO" : "Awaiting prices"}
            </span>
          )}
        </Kpi>
        <Kpi label="Actual Profit">
          {fin.actualProfit !== null ? (
            <span className={fin.actualProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatCurrency(fin.actualProfit)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Kpi>
        <Kpi label="Actual Margin %">
          <span className={marginColor(fin.actualMarginPct)}>
            {fin.actualMarginPct !== null ? `${fin.actualMarginPct.toFixed(1)}%` : "—"}
          </span>
        </Kpi>
      </div>

      <CpoTabs cpo={cpo} spos={cpo.supplierPOs} totalRev={fin.revenue} />
    </div>
  )
}
