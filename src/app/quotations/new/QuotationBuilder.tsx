"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Download, Eye, FileText, List, Plus, Save, Trash2, User } from "lucide-react"
import { createQuotation, updateQuotation } from "@/app/actions/quotations"
import { useFeedback } from "@/components/ui/Feedback"
import QuotationDocument from "@/components/quotation/QuotationDocument"
import { downloadElementAsPdf, pdfFileName } from "@/components/quotation/pdf"
import { DEFAULT_TERMS, parseTerms, type QuotationWithRelations, type Term } from "@/components/quotation/types"
import { calcQuotationTotals } from "@/lib/totals"
import { formatCurrency, toDateInput } from "@/lib/utils"
import ItemTable from "./ItemTable"
import {
  buildPayload,
  newItem,
  newRowId,
  toBuilderItem,
  toDocItem,
  toDocSection,
  type BuilderItem,
  type BuilderSection,
  type CustomerOption,
  type ProductOption,
  type ServiceOption,
  type UnitOption,
} from "./builder-model"

type QuotationType = "PRODUCT" | "SERVICE" | "MIXED"

const input = "w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm outline-none"
const label = "block text-[11px] font-bold text-muted-foreground uppercase mb-1.5"

type Props = {
  products: ProductOption[]
  services?: ServiceOption[]
  units?: UnitOption[]
  customers?: CustomerOption[]
  /** Suggested number for a NEW quotation (the real one is allocated on save). */
  suggestedRefNo?: string
  initialQuotation?: QuotationWithRelations
}

function customerBlock(c: CustomerOption): string {
  return c.contactDetails ? `${c.name}\n${c.contactDetails}` : c.name
}

export default function QuotationBuilder({
  products,
  services = [],
  units = [],
  customers = [],
  suggestedRefNo = "",
  initialQuotation,
}: Props) {
  const router = useRouter()
  const { notify, toast } = useFeedback()
  const isEdit = Boolean(initialQuotation)

  const [customerId, setCustomerId] = useState(initialQuotation?.customerId ?? "")
  const [customerAddress, setCustomerAddress] = useState(
    initialQuotation?.customerAddress ??
      (initialQuotation?.customer ? customerBlock(initialQuotation.customer) : ""),
  )
  const [salutation, setSalutation] = useState(initialQuotation?.salutation ?? "Dear Sir / Madam,")
  const [subject, setSubject] = useState(initialQuotation?.subject ?? "")
  const [refNo, setRefNo] = useState(initialQuotation?.refNo ?? suggestedRefNo)
  const [refEdited, setRefEdited] = useState(false)
  const [date, setDate] = useState(toDateInput(initialQuotation?.date))
  const [validUntil, setValidUntil] = useState(initialQuotation?.validUntil ? toDateInput(initialQuotation.validUntil) : "")
  const [quotationType, setQuotationType] = useState<QuotationType>(initialQuotation?.type ?? "PRODUCT")

  const [items, setItems] = useState<BuilderItem[]>(() => {
    const loose = initialQuotation?.items.filter(i => !i.sectionId).sort((a, b) => a.order - b.order)
    return loose?.length ? loose.map(toBuilderItem) : initialQuotation ? [] : [newItem()]
  })
  const [sections, setSections] = useState<BuilderSection[]>(() =>
    (initialQuotation?.sections ?? [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(s => ({ id: s.id, name: s.name, items: s.items.slice().sort((a, b) => a.order - b.order).map(toBuilderItem) })),
  )

  const [gstOn, setGstOn] = useState(initialQuotation?.includeGst ?? true)
  const [gstPct, setGstPct] = useState(initialQuotation?.gstPct ?? 18)
  const [frOn, setFrOn] = useState(initialQuotation?.includeFreight ?? true)
  const [freight, setFreight] = useState(initialQuotation?.freightAmount ?? 0)
  const [terms, setTerms] = useState<Term[]>(() => {
    const saved = parseTerms(initialQuotation?.terms)
    return initialQuotation ? saved : DEFAULT_TERMS
  })

  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const defaultType = quotationType === "SERVICE" ? "SERVICE" : "PRODUCT"

  const totals = useMemo(
    () =>
      calcQuotationTotals({
        lines: [...items, ...sections.flatMap(s => s.items)].map(i => ({ qty: i.qty, price: i.rate, cost: i.estCost })),
        includeGst: gstOn,
        gstPct,
        includeFreight: frOn,
        freightAmount: freight,
      }),
    [items, sections, gstOn, gstPct, frOn, freight],
  )

  // --- item handlers (stable identities so memoised rows don't re-render) ---
  const changeLoose = useCallback((item: BuilderItem) => setItems(prev => prev.map(i => (i.id === item.id ? item : i))), [])
  const removeLoose = useCallback((id: string) => setItems(prev => prev.filter(i => i.id !== id)), [])
  const changeInSection = useCallback(
    (sectionId: string, item: BuilderItem) =>
      setSections(prev =>
        prev.map(s => (s.id === sectionId ? { ...s, items: s.items.map(i => (i.id === item.id ? item : i)) } : s)),
      ),
    [],
  )
  const removeInSection = useCallback(
    (sectionId: string, itemId: string) =>
      setSections(prev => prev.map(s => (s.id === sectionId ? { ...s, items: s.items.filter(i => i.id !== itemId) } : s))),
    [],
  )

  const addLoose = () => setItems(prev => [...prev, newItem(defaultType)])
  const addInSection = (sectionId: string) =>
    setSections(prev => prev.map(s => (s.id === sectionId ? { ...s, items: [...s.items, newItem(defaultType)] } : s)))
  const addSection = () => setSections(prev => [...prev, { id: newRowId(), name: "New Section", items: [] }])

  const handleCustomerChange = (id: string) => {
    setCustomerId(id)
    const picked = customers.find(c => c.id === id)
    if (picked) setCustomerAddress(customerBlock(picked))
  }

  const updateTerm = (id: number, patch: Partial<Term>) =>
    setTerms(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)))
  const addTerm = () => setTerms(prev => [...prev, { id: Math.max(0, ...prev.map(t => t.id)) + 1, label: "", value: "" }])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = buildPayload({
        customerId,
        customerAddress,
        // Only send the number if the user typed one; otherwise the server
        // allocates the next free number so two people never clash.
        refNo: isEdit ? refNo : refEdited ? refNo : undefined,
        date,
        validUntil,
        salutation,
        subject,
        type: quotationType,
        gstOn,
        gstPct,
        frOn,
        freight,
        terms,
        sections,
        items,
      })

      if (initialQuotation) {
        const res = await updateQuotation(initialQuotation.id, payload)
        if (!notify(res, "Quotation updated.")) return
        router.push(`/quotations/${initialQuotation.id}`)
      } else {
        const res = await createQuotation(payload)
        if (!notify(res)) return
        toast(`Quotation ${res.data.refNo} saved.`, "success")
        router.push(`/quotations/${res.data.id}`)
      }
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!previewRef.current) return
    const wrapper = previewRef.current.parentElement
    const wasHidden = wrapper?.classList.contains("hidden")
    wrapper?.classList.remove("hidden")
    try {
      await downloadElementAsPdf(previewRef.current, pdfFileName(refNo || "Quotation"))
    } catch (e) {
      console.error(e)
      toast("Could not generate the PDF.", "error")
    } finally {
      if (wasHidden) wrapper?.classList.add("hidden")
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <datalist id="dl_units">
        {units.map(u => (
          <option key={u.id} value={u.name} />
        ))}
      </datalist>

      {/* Topbar */}
      <div className="bg-card border border-card-border rounded-xl p-4 flex justify-between items-center mb-6 shadow-sm">
        <div>
          <div className="font-serif text-accent text-xl font-black tracking-tight leading-none">Megatech Solutions</div>
          <div className="text-muted-foreground text-xs mt-1 tracking-wider">Universal Quotation Engine</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 border border-card-border rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => setShowPreview(v => !v)}
            className="px-4 py-2 border border-card-border rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-muted transition-colors"
          >
            <Eye size={16} /> {showPreview ? "Hide Preview" : "Preview"}
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-accent/90 transition-colors"
          >
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-4 mb-4 flex gap-4 items-center">
        <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quotation Type:</span>
        <select
          value={quotationType}
          onChange={e => setQuotationType(e.target.value as QuotationType)}
          className="border border-card-border bg-transparent text-foreground rounded p-2 text-sm font-bold"
        >
          <option value="PRODUCT">Product Supply</option>
          <option value="SERVICE">Service / Installation</option>
          <option value="MIXED">Mixed (Products + Services)</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Party Details */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-card-border">
            <div className="w-8 h-8 bg-muted border border-card-border rounded-lg flex items-center justify-center text-foreground/70">
              <User size={16} />
            </div>
            <div className="text-xs font-bold text-foreground uppercase tracking-widest">Party Details</div>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="customer" className={label}>Customer</label>
              <select id="customer" value={customerId} onChange={e => handleCustomerChange(e.target.value)} className={input}>
                <option value="">— Not linked to a customer —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Linking a customer attaches this quotation to their profile and carries through to the customer PO.
              </p>
            </div>
            <div>
              <label htmlFor="to" className={label}>To (as printed on the quotation)</label>
              <textarea
                id="to"
                value={customerAddress}
                onChange={e => setCustomerAddress(e.target.value)}
                rows={4}
                className={`${input} resize-y`}
                placeholder="e.g. ABC Pvt. Ltd."
              />
            </div>
            <div>
              <label htmlFor="salutation" className={label}>Salutation</label>
              <input id="salutation" value={salutation} onChange={e => setSalutation(e.target.value)} className={input} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="subject" className={label}>Subject / Reference</label>
                <input id="subject" value={subject} onChange={e => setSubject(e.target.value)} className={input} />
              </div>
              <div>
                <label htmlFor="refno" className={label}>Quotation No.</label>
                <input
                  id="refno"
                  value={refNo}
                  onChange={e => {
                    setRefNo(e.target.value)
                    setRefEdited(true)
                  }}
                  className={input}
                  placeholder="Assigned on save"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Quotation Info & Totals */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-card-border">
            <div className="w-8 h-8 bg-muted border border-card-border rounded-lg flex items-center justify-center text-foreground/70">
              <FileText size={16} />
            </div>
            <div className="text-xs font-bold text-foreground uppercase tracking-widest">Quotation Info</div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div>
              <label htmlFor="date" className={label}>Date</label>
              <input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="valid" className={label}>Valid Until</label>
              <input id="valid" type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={input} />
            </div>
          </div>

          <div className="border border-card-border rounded-xl overflow-hidden">
            <div className="flex justify-between items-center p-3 text-sm border-b border-card-border bg-card">
              <span className="font-semibold text-muted-foreground">Subtotal</span>
              <span className="font-bold text-foreground">{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="p-3 bg-muted/50 border-b border-card-border space-y-2 text-xs">
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 font-bold cursor-pointer w-36">
                  <input type="checkbox" checked={gstOn} onChange={e => setGstOn(e.target.checked)} /> Include GST
                </label>
                <input
                  aria-label="GST percent"
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  disabled={!gstOn}
                  value={gstPct}
                  onChange={e => setGstPct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className="w-20 border border-card-border bg-transparent rounded p-1.5 text-right disabled:opacity-40"
                />
                <span className="text-muted-foreground">%</span>
                <span className="ml-auto font-semibold text-foreground">{formatCurrency(totals.gstAmount)}</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 font-bold cursor-pointer w-36">
                  <input type="checkbox" checked={frOn} onChange={e => setFrOn(e.target.checked)} /> Include Freight
                </label>
                <input
                  aria-label="Freight amount"
                  type="number"
                  min={0}
                  step="any"
                  disabled={!frOn}
                  value={freight}
                  onChange={e => setFreight(Math.max(0, Number(e.target.value) || 0))}
                  className="w-28 border border-card-border bg-transparent rounded p-1.5 text-right disabled:opacity-40"
                />
                <span className="ml-auto font-semibold text-foreground">{formatCurrency(totals.freightAmount)}</span>
              </div>
            </div>
            <div className="flex justify-between items-center p-4 text-base bg-accent text-accent-foreground font-bold">
              <span>Grand Total</span>
              <span className="text-lg">{formatCurrency(totals.grandTotal)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2 text-xs bg-muted/40 border-t border-card-border">
              <span className="text-muted-foreground">Expected profit (internal)</span>
              <span className={totals.expectedProfit >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-rose-600"}>
                {formatCurrency(totals.expectedProfit)} ({totals.expectedMarginPct.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sections and Items */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-card-border justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-muted border border-card-border rounded-lg flex items-center justify-center">
              <List size={16} />
            </div>
            <div className="text-xs font-bold uppercase tracking-widest">Line Items</div>
          </div>
          <button type="button" onClick={addSection} className="text-xs font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-full">
            + Add Section
          </button>
        </div>

        <div className="space-y-6">
          {sections.map(sec => (
            <div key={sec.id} className="border border-card-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 p-2 flex justify-between items-center border-b border-card-border">
                <input
                  aria-label="Section name"
                  value={sec.name}
                  onChange={e => setSections(prev => prev.map(s => (s.id === sec.id ? { ...s, name: e.target.value } : s)))}
                  className="font-bold text-sm bg-transparent outline-none w-1/2 px-2"
                  placeholder="Section Name"
                />
                <button
                  type="button"
                  aria-label="Remove section"
                  onClick={() => setSections(prev => prev.filter(s => s.id !== sec.id))}
                  className="text-rose-500 hover:bg-rose-50 p-1 rounded"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <ItemTable
                items={sec.items}
                products={products}
                services={services}
                onAdd={() => addInSection(sec.id)}
                onChange={item => changeInSection(sec.id, item)}
                onRemove={itemId => removeInSection(sec.id, itemId)}
              />
            </div>
          ))}

          <ItemTable
            items={items}
            products={products}
            services={services}
            onAdd={addLoose}
            onChange={changeLoose}
            onRemove={removeLoose}
            hideHeader={sections.length > 0}
          />
        </div>
      </div>

      {/* Terms */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-card-border">
          <div className="text-xs font-bold uppercase tracking-widest">Terms &amp; Conditions</div>
          <button type="button" onClick={addTerm} className="text-xs font-bold text-accent flex items-center gap-1">
            <Plus size={12} /> Add Term
          </button>
        </div>
        <div className="space-y-2">
          {terms.map(t => (
            <div key={t.id} className="flex gap-2">
              <input
                aria-label="Term label"
                value={t.label}
                onChange={e => updateTerm(t.id, { label: e.target.value })}
                className="w-48 border border-card-border bg-transparent rounded p-2 text-sm font-semibold"
                placeholder="Label"
              />
              <input
                aria-label="Term text"
                value={t.value}
                onChange={e => updateTerm(t.id, { value: e.target.value })}
                className="flex-1 border border-card-border bg-transparent rounded p-2 text-sm"
                placeholder="Text"
              />
              <button
                type="button"
                aria-label="Remove term"
                onClick={() => setTerms(prev => prev.filter(x => x.id !== t.id))}
                className="text-muted-foreground hover:text-rose-500 p-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview / PDF source */}
      <div className={`mt-8 bg-gray-200 p-8 rounded-xl ${showPreview ? "block" : "hidden"}`}>
        <QuotationDocument
          ref={previewRef}
          customerBlock={customerAddress}
          date={date || new Date()}
          refNo={refNo}
          subject={subject}
          salutation={salutation}
          sections={sections.map(toDocSection)}
          items={items.map(toDocItem)}
          totals={totals}
          includeGst={gstOn}
          gstPct={gstPct}
          includeFreight={frOn}
          terms={terms}
        />
      </div>
    </div>
  )
}
