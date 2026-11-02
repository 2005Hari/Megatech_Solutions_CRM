"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Calendar, ClipboardCheck, Download, Edit, Eye, FileText, GitBranch, Info } from "lucide-react"
import { createQuotationRevision, setQuotationStatus } from "@/app/actions/quotations"
import { useFeedback } from "@/components/ui/Feedback"
import { StatusBadge } from "@/components/ui/StatusBadge"
import QuotationDocument from "@/components/quotation/QuotationDocument"
import { downloadElementAsPdf, pdfFileName } from "@/components/quotation/pdf"
import { parseTerms, type DocItem, type QuotationWithRelations } from "@/components/quotation/types"
import { calcQuotationTotals, lineTotal } from "@/lib/totals"
import {
  CONVERTIBLE_QUOTATION_STATUSES,
  EDITABLE_QUOTATION_STATUSES,
  QUOTATION_TRANSITIONS,
  REVISABLE_QUOTATION_STATUSES,
} from "@/lib/status"
import { formatCurrency, formatDate } from "@/lib/utils"
import UploadCPOModal from "../upload-cpo"
import DeleteQuotationButton from "../DeleteQuotationButton"

type SavedItem = QuotationWithRelations["items"][number]

const toDocItem = (i: SavedItem): DocItem => ({
  id: i.id,
  brand: i.brand ?? "",
  desc: i.productName,
  qty: i.qty,
  unit: i.unit ?? "",
  rate: i.sellPrice,
})

const btn =
  "px-4 py-2 border border-card-border hover:bg-muted text-foreground rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"

function ItemRows({ items }: { items: SavedItem[] }) {
  return items.map((item, idx) => {
    const cost = item.estimatedCost ?? 0
    const marginPct = item.sellPrice > 0 && cost > 0 ? ((item.sellPrice - cost) / item.sellPrice) * 100 : null
    return (
      <tr key={item.id} className="hover:bg-muted/30">
        <td className="px-5 py-3.5 text-center text-xs font-bold text-muted-foreground">{idx + 1}</td>
        <td className="px-5 py-3.5 font-medium text-foreground">{item.brand || "—"}</td>
        <td className="px-5 py-3.5 font-semibold text-foreground whitespace-pre-wrap">{item.productName}</td>
        <td className="px-5 py-3.5 text-right font-medium text-foreground">{item.qty}</td>
        <td className="px-5 py-3.5 text-right font-medium text-muted-foreground">{cost > 0 ? formatCurrency(cost) : "—"}</td>
        <td className="px-5 py-3.5 text-right font-semibold text-foreground">{formatCurrency(item.sellPrice)}</td>
        <td className="px-5 py-3.5 text-right font-semibold">
          {marginPct === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className={marginPct >= 15 ? "text-emerald-600" : marginPct > 0 ? "text-amber-600" : "text-rose-600"}>
              {marginPct.toFixed(1)}%
            </span>
          )}
        </td>
        <td className="px-5 py-3.5 text-right font-bold text-foreground">{formatCurrency(lineTotal(item.qty, item.sellPrice))}</td>
      </tr>
    )
  })
}

export default function QuotationDetailsClient({ quotation }: { quotation: QuotationWithRelations }) {
  const router = useRouter()
  const { notify, toast, confirm } = useFeedback()
  const [showPreview, setShowPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const sections = useMemo(() => quotation.sections.slice().sort((a, b) => a.order - b.order), [quotation.sections])
  const looseItems = useMemo(
    () => quotation.items.filter(i => !i.sectionId).sort((a, b) => a.order - b.order),
    [quotation.items],
  )
  const allItems = useMemo(() => [...looseItems, ...sections.flatMap(s => s.items)], [looseItems, sections])

  const totals = useMemo(
    () =>
      calcQuotationTotals({
        lines: allItems.map(i => ({ qty: i.qty, price: i.sellPrice, cost: i.estimatedCost })),
        includeGst: quotation.includeGst,
        gstPct: quotation.gstPct, // 0% is a valid rate - do not fall back to 18
        includeFreight: quotation.includeFreight,
        freightAmount: quotation.freightAmount,
      }),
    [allItems, quotation],
  )

  const terms = useMemo(() => parseTerms(quotation.terms), [quotation.terms])
  const customerBlock =
    quotation.customerAddress ??
    (quotation.customer
      ? `${quotation.customer.name}${quotation.customer.contactDetails ? "\n" + quotation.customer.contactDetails : ""}`
      : "")

  const canEdit = EDITABLE_QUOTATION_STATUSES.includes(quotation.status)
  const canConvert = CONVERTIBLE_QUOTATION_STATUSES.includes(quotation.status)
  const canRevise = REVISABLE_QUOTATION_STATUSES.includes(quotation.status)
  const nextStatuses = QUOTATION_TRANSITIONS[quotation.status] ?? []

  const handleStatusChange = async (status: string) => {
    if (!status) return
    setBusy(true)
    try {
      const res = await setQuotationStatus(quotation.id, status)
      if (notify(res, `Status changed to ${status}.`)) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const handleRevision = async () => {
    const ok = await confirm({
      title: "Create a new revision?",
      message: `${quotation.refNo} will be marked as Revised and a new draft copy will be opened for editing.`,
      confirmLabel: "Create revision",
    })
    if (!ok) return
    setBusy(true)
    try {
      const res = await createQuotationRevision(quotation.id)
      if (!notify(res, undefined)) return
      toast(`Revision ${res.data.refNo} created.`, "success")
      router.push(`/quotations/${res.data.id}/edit`)
    } finally {
      setBusy(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!previewRef.current) return
    const wrapper = previewRef.current.parentElement
    const wasHidden = wrapper?.classList.contains("hidden")
    wrapper?.classList.remove("hidden")
    try {
      await downloadElementAsPdf(previewRef.current, pdfFileName(quotation.refNo))
    } catch (e) {
      console.error(e)
      toast("Could not generate the PDF.", "error")
    } finally {
      if (wasHidden) wrapper?.classList.add("hidden")
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Top Controls */}
      <div className="bg-card border border-card-border rounded-xl p-4 flex flex-wrap gap-3 justify-between items-center mb-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground text-base">{quotation.refNo}</span>
            <StatusBadge status={quotation.status} />
          </div>
          <div className="text-muted-foreground text-xs mt-1 font-medium">{quotation.customer?.name || "Manual Entry"}</div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {canEdit && (
            <Link href={`/quotations/${quotation.id}/edit`} className={btn}>
              <Edit size={16} /> Edit Quotation
            </Link>
          )}
          {canRevise && (
            <button onClick={handleRevision} disabled={busy} className={btn}>
              <GitBranch size={16} /> New Revision
            </button>
          )}
          {nextStatuses.length > 0 && (
            <select
              aria-label="Change status"
              value=""
              disabled={busy}
              onChange={e => handleStatusChange(e.target.value)}
              className="px-3 py-2 border border-card-border bg-transparent text-foreground rounded-lg text-sm font-semibold"
            >
              <option value="">Change status…</option>
              {nextStatuses.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
          <button onClick={() => setShowPreview(v => !v)} className={btn}>
            <Eye size={16} /> {showPreview ? "Hide Document Preview" : "Document Preview"}
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Download size={16} /> Download PDF
          </button>
          {canConvert && (
            <div className="px-4 py-2 border border-card-border rounded-lg flex items-center">
              <UploadCPOModal
                quotationId={quotation.id}
                quotationRef={quotation.refNo}
                customerName={quotation.customer?.name || "Manual Entry"}
              />
            </div>
          )}
          <DeleteQuotationButton
            quotationId={quotation.id}
            refNo={quotation.refNo}
            redirectTo="/quotations"
            className="px-4 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors"
            showText
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-card-border pb-3 flex items-center gap-2">
              <Info size={14} /> Quotation Details
            </h3>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground text-xs font-bold block mb-1 uppercase">Date</span>
                  <span className="font-semibold text-foreground">{formatDate(quotation.date)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs font-bold block mb-1 uppercase">Valid Until</span>
                  <span className="font-semibold text-foreground">{quotation.validUntil ? formatDate(quotation.validUntil) : "—"}</span>
                </div>
              </div>
              {quotation.subject && (
                <div>
                  <span className="text-muted-foreground text-xs font-bold block mb-1 uppercase">Subject</span>
                  <span className="font-medium text-foreground">{quotation.subject}</span>
                </div>
              )}
              {quotation.salutation && (
                <div>
                  <span className="text-muted-foreground text-xs font-bold block mb-1 uppercase">Salutation</span>
                  <span className="text-muted-foreground font-medium italic">&ldquo;{quotation.salutation}&rdquo;</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-card-border bg-muted/30 flex items-center gap-2">
              <FileText size={14} className="text-muted-foreground" />
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Line Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground border-b border-card-border tracking-wider">
                  <tr>
                    <th className="px-5 py-3 text-center">Sr.</th>
                    <th className="px-5 py-3">Brand</th>
                    <th className="px-5 py-3">Product Description</th>
                    <th className="px-5 py-3 text-right">Qty</th>
                    <th className="px-5 py-3 text-right">Est. Cost</th>
                    <th className="px-5 py-3 text-right">Rate</th>
                    <th className="px-5 py-3 text-right">Margin</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                {sections.map(sec => (
                  <tbody key={sec.id} className="divide-y divide-card-border">
                    <tr className="bg-muted/40">
                      <td colSpan={8} className="px-5 py-2 text-xs font-bold text-foreground uppercase tracking-wider">
                        {sec.name}
                      </td>
                    </tr>
                    <ItemRows items={sec.items.slice().sort((a, b) => a.order - b.order)} />
                  </tbody>
                ))}
                {looseItems.length > 0 && (
                  <tbody className="divide-y divide-card-border">
                    {sections.length > 0 && (
                      <tr className="bg-muted/40">
                        <td colSpan={8} className="px-5 py-2 text-xs font-bold text-foreground uppercase tracking-wider">
                          Other Items
                        </td>
                      </tr>
                    )}
                    <ItemRows items={looseItems} />
                  </tbody>
                )}
              </table>
            </div>
          </div>
        </div>

        <div className="col-span-1 space-y-6">
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-card-border pb-3 flex items-center gap-2">
              <Calendar size={14} /> Commercial Summary
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-card-border pb-2">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground">{formatCurrency(totals.subtotal)}</span>
              </div>
              {quotation.includeGst && (
                <div className="flex justify-between border-b border-card-border pb-2">
                  <span className="text-muted-foreground">GST ({quotation.gstPct}%)</span>
                  <span className="font-semibold text-foreground">{formatCurrency(totals.gstAmount)}</span>
                </div>
              )}
              {quotation.includeFreight && (
                <div className="flex justify-between border-b border-card-border pb-2">
                  <span className="text-muted-foreground">Freight</span>
                  <span className="font-semibold text-foreground">{formatCurrency(totals.freightAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-card-border mt-2">
                <span className="font-bold text-foreground">Grand Total</span>
                <span className="font-bold text-lg text-accent">{formatCurrency(totals.grandTotal)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-card-border mt-2 bg-muted/20 p-2 rounded-lg">
                <span className="text-muted-foreground font-semibold">Expected Profit</span>
                <span className={`font-bold ${totals.expectedProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatCurrency(totals.expectedProfit)} ({totals.expectedMarginPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {terms.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-card-border pb-3 flex items-center gap-2">
                <ClipboardCheck size={14} /> Terms &amp; Conditions
              </h3>
              <div className="space-y-3.5">
                {terms.map((tc, i) => (
                  <div key={tc.id} className="text-xs">
                    <span className="font-bold text-foreground block mb-0.5">
                      {i + 1}. {tc.label}
                    </span>
                    <span className="text-muted-foreground leading-relaxed font-medium">{tc.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formal document: preview + PDF source */}
      <div className={`mt-8 bg-slate-200 p-8 rounded-xl ${showPreview ? "block" : "hidden"}`}>
        <QuotationDocument
          ref={previewRef}
          customerBlock={customerBlock}
          date={quotation.date}
          refNo={quotation.refNo}
          subject={quotation.subject ?? ""}
          salutation={quotation.salutation ?? ""}
          sections={sections.map(s => ({
            id: s.id,
            name: s.name,
            items: s.items.slice().sort((a, b) => a.order - b.order).map(toDocItem),
          }))}
          items={looseItems.map(toDocItem)}
          totals={totals}
          includeGst={quotation.includeGst}
          gstPct={quotation.gstPct}
          includeFreight={quotation.includeFreight}
          terms={terms}
        />
      </div>
    </div>
  )
}
