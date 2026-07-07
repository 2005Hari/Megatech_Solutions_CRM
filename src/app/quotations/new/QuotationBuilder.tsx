"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createQuotation, updateQuotation } from "@/app/actions/quotations"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Save, Eye, Download, User, FileText, List, Trash2, PlusCircle, ClipboardCheck, ChevronUp, ChevronDown } from "lucide-react"

export default function QuotationBuilder({ 
  products,
  initialQuotation
}: { 
  products: any[]
  initialQuotation?: any
}) {
  const router = useRouter()
  
  // State Initialization from initialQuotation
  const initialAddress = initialQuotation?.customerAddress || ""

  const [customerAddress, setCustomerAddress] = useState(initialQuotation ? initialAddress : "")
  const [salutation, setSalutation] = useState(initialQuotation?.salutation || "Dear Sir / Madam,")
  const [subject, setSubject] = useState(initialQuotation?.subject || "")
  const [qno, setQno] = useState(initialQuotation?.refNo || `MTS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`)
  const [date, setDate] = useState(initialQuotation?.date ? new Date(initialQuotation.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0])
  const [validUntil, setValidUntil] = useState(initialQuotation?.validUntil ? new Date(initialQuotation.validUntil).toISOString().split("T")[0] : "")
  
  const [items, setItems] = useState<{id: any, brand: string, desc: string, qty: number, rate: number, estCost: number}[]>(
    initialQuotation?.items.map((i: any) => ({
      id: i.id,
      brand: i.brand || "",
      desc: i.productName,
      qty: i.qty,
      rate: i.sellPrice,
      estCost: i.estimatedCost || 0
    })) || [
      { id: 1, brand: "", desc: "", qty: 1, rate: 0, estCost: 0 }
    ]
  )
  const [nextItemId, setNextItemId] = useState(initialQuotation ? 999 : 2)
  
  const [gstOn, setGstOn] = useState(initialQuotation ? initialQuotation.includeGst : true)
  const [gstPct, setGstPct] = useState(initialQuotation?.gstPct || 18)
  const [frOn, setFrOn] = useState(initialQuotation ? initialQuotation.includeFreight : true)
  const [freight, setFreight] = useState(initialQuotation?.freightAmount || 0)

  const [tcs, setTcs] = useState<{id: any, label: string, value: string}[]>(() => {
    if (initialQuotation?.terms) {
      try {
        return JSON.parse(initialQuotation.terms)
      } catch (e) {
        console.error(e)
      }
    }
    return [
      { id: 1, label: 'GST', value: 'Inclusive / Extra as applicable' },
      { id: 2, label: 'Delivery Period', value: '_____ days from the date of Purchase Order' },
      { id: 3, label: 'Freight Charges', value: 'Inclusive / Extra as applicable' },
      { id: 4, label: 'Payment', value: '100% advance with Purchase Order' },
      { id: 5, label: 'Warranty', value: 'As per manufacturer warranty' },
      { id: 6, label: 'Validity', value: 'Quotation valid for 15 days only' }
    ]
  })
  const [nextTcId, setNextTcId] = useState(initialQuotation ? 999 : 7)
  const [newTcLabel, setNewTcLabel] = useState("")
  const [newTcValue, setNewTcValue] = useState("")

  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  // Calcs
  const subtotal = items.reduce((sum, item) => sum + (item.qty * item.rate), 0)
  const gstAmount = gstOn ? subtotal * (gstPct / 100) : 0
  const frAmount = frOn ? freight : 0
  const grandTotal = subtotal + gstAmount + frAmount

  // Handlers

  const handleProductSelect = (id: any, desc: string) => {
    const prod = products.find(p => p.desc === desc)
    setItems(items.map(item => {
      if (item.id === id) {
        if (prod) return { ...item, desc: prod.desc, brand: prod.brand, rate: prod.rate }
        return { ...item, desc }
      }
      return item
    }))
  }

  const handleSave = async () => {
    if (!qno) return alert("Quotation number required.")
    
    setSaving(true)
    try {
      const payload = {
        customerId: "",
        refNo: qno,
        date,
        validUntil: validUntil || undefined,
        salutation,
        subject,
        includeGst: gstOn,
        gstPct,
        includeFreight: frOn,
        freightAmount: frAmount,
        terms: JSON.stringify(tcs),
        items: items.filter(i => i.desc).map(i => ({
          id: typeof i.id === "string" ? i.id : undefined, // Include DB ID if present
          brand: i.brand,
          productName: i.desc,
          qty: i.qty,
          unit: "nos",
          sellPrice: i.rate,
          estimatedCost: i.estCost
        }))
      }

      if (initialQuotation) {
        await updateQuotation(initialQuotation.id, payload)
        alert("Quotation updated successfully!")
        router.push(`/quotations/${initialQuotation.id}`)
      } else {
        await createQuotation(payload)
        alert("Saved successfully!")
        router.push("/quotations")
      }
      router.refresh()
    } catch (e: any) {
      alert("Failed to save: " + e.message)
    }
    setSaving(false)
  }

  const handleDownloadPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf")
      const html2canvas = (await import("html2canvas")).default

      if (!previewRef.current) return
      
      const prevDisplay = previewRef.current.style.display
      previewRef.current.style.display = "block"

      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff"
      })
      
      previewRef.current.style.display = prevDisplay

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      
      const imgProps = pdf.getImageProperties(imgData)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`Megatech_${qno.replace(/\//g, '-')}.pdf`)
    } catch (e) {
      console.error(e)
      alert("Failed to generate PDF. Make sure jspdf and html2canvas are installed.")
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <datalist id="dl_products">
        {products.map(p => <option key={p.desc} value={p.desc} />)}
      </datalist>

      {/* Topbar */}
      <div className="bg-card border border-card-border rounded-xl p-4 flex justify-between items-center mb-6 shadow-sm">
        <div>
          <div className="font-serif text-accent text-xl font-black tracking-tight leading-none">Megatech Solutions</div>
          <div className="text-muted-foreground text-xs mt-1 tracking-wider">Quotation Builder · Your Premier IT Partner</div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 border border-card-border rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-muted text-foreground transition-colors">
            <Save size={16} /> {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={() => setShowPreview(!showPreview)} className="px-4 py-2 border border-card-border rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-muted text-foreground transition-colors">
            <Eye size={16} /> {showPreview ? "Hide Preview" : "Preview"}
          </button>
          <button onClick={handleDownloadPDF} className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-accent/90 transition-colors">
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Party Details */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-card-border">
            <div className="w-8 h-8 bg-muted border border-card-border rounded-lg flex items-center justify-center text-foreground/70"><User size={16} /></div>
            <div className="text-xs font-bold text-foreground uppercase tracking-widest">Party Details</div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1.5">To (Party / Company Name)</label>
              <textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} rows={4} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-foreground outline-none resize-y" placeholder="e.g. ABC Pvt. Ltd." />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1.5">Salutation</label>
              <input value={salutation} onChange={e => setSalutation(e.target.value)} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-foreground outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1.5">Subject / Reference</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-foreground outline-none" placeholder="Ref. or subject" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1.5">Quotation No.</label>
                <input value={qno} onChange={e => setQno(e.target.value)} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-foreground outline-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Quotation Info & Totals */}
        <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-card-border">
            <div className="w-8 h-8 bg-muted border border-card-border rounded-lg flex items-center justify-center text-foreground/70"><FileText size={16} /></div>
            <div className="text-xs font-bold text-foreground uppercase tracking-widest">Quotation Info</div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-foreground outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1.5">Valid Until</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-foreground outline-none" />
            </div>
          </div>

          <div className="border border-card-border rounded-xl overflow-hidden">
            <div className="flex justify-between items-center p-3 text-sm border-b border-card-border bg-card">
              <span className="font-semibold text-muted-foreground">Subtotal</span>
              <span className="font-bold text-foreground">{formatCurrency(subtotal)}</span>
            </div>

            <div className="p-3 bg-muted/50 border-b border-card-border flex gap-3">
              <label className={`flex items-center gap-2 text-xs font-bold cursor-pointer rounded-full px-3 py-1.5 border transition-colors ${gstOn ? 'bg-accent text-accent-foreground border-accent' : 'bg-transparent border-card-border text-muted-foreground'}`}>
                <input type="checkbox" checked={gstOn} onChange={e => setGstOn(e.target.checked)} className="accent-foreground" /> Include GST
              </label>
              <label className={`flex items-center gap-2 text-xs font-bold cursor-pointer rounded-full px-3 py-1.5 border transition-colors ${frOn ? 'bg-accent text-accent-foreground border-accent' : 'bg-transparent border-card-border text-muted-foreground'}`}>
                <input type="checkbox" checked={frOn} onChange={e => setFrOn(e.target.checked)} className="accent-foreground" /> Include Freight
              </label>
            </div>

            <div className={`flex justify-between items-center p-3 text-sm border-b border-card-border bg-card ${!gstOn && 'opacity-40 pointer-events-none'}`}>
              <span className="font-semibold text-muted-foreground">GST %</span>
              <input type="number" value={gstPct} onChange={e => setGstPct(parseFloat(e.target.value))} className="w-20 border border-card-border bg-transparent text-foreground rounded text-right px-2 py-1 outline-none focus:ring-1 focus:ring-foreground" />
            </div>
            <div className={`flex justify-between items-center p-3 text-sm border-b border-card-border bg-card ${!gstOn && 'opacity-40 pointer-events-none'}`}>
              <span className="font-semibold text-muted-foreground">GST Amount</span>
              <span className="font-bold text-foreground">{formatCurrency(gstAmount)}</span>
            </div>
            <div className={`flex justify-between items-center p-3 text-sm border-b border-card-border bg-card ${!frOn && 'opacity-40 pointer-events-none'}`}>
              <span className="font-semibold text-muted-foreground">Freight (₹)</span>
              <input type="number" value={freight} onChange={e => setFreight(parseFloat(e.target.value))} className="w-24 border border-card-border bg-transparent text-foreground rounded text-right px-2 py-1 outline-none focus:ring-1 focus:ring-foreground" />
            </div>
            
            <div className="flex justify-between items-center p-4 text-base bg-accent text-accent-foreground font-bold">
              <span>Grand Total</span>
              <span className="text-lg">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-card-border">
          <div className="w-8 h-8 bg-muted border border-card-border rounded-lg flex items-center justify-center text-foreground/70"><List size={16} /></div>
          <div className="text-xs font-bold text-foreground uppercase tracking-widest">Line Items</div>
        </div>

        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-card-border">
              <th className="p-3 w-10 text-center">Sr.</th>
              <th className="p-3 w-[15%]">Brand</th>
              <th className="p-3">Product Description</th>
              <th className="p-3 w-20 text-right">Qty</th>
              <th className="p-3 w-28 text-right">Est. Cost (₹)</th>
              <th className="p-3 w-28 text-right">Rate (₹)</th>
              <th className="p-3 w-28 text-right">Amount (₹)</th>
              <th className="p-3 w-24 text-center">Margin</th>
              <th className="p-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => {
              const marginAmt = (it.rate - it.estCost) * it.qty;
              const marginPct = it.rate > 0 ? ((it.rate - it.estCost) / it.rate) * 100 : 0;
              return (
              <tr key={it.id} className="border-b border-card-border last:border-0 hover:bg-muted/30">
                <td className="p-2 text-center text-xs font-bold text-muted-foreground">{idx + 1}</td>
                <td className="p-2"><input value={it.brand} onChange={e => setItems(items.map(i => i.id === it.id ? { ...i, brand: e.target.value } : i))} className="w-full border border-card-border bg-transparent text-foreground rounded p-2 text-sm outline-none focus:ring-1 focus:ring-foreground" placeholder="Brand" /></td>
                <td className="p-2"><input list="dl_products" value={it.desc} onChange={e => handleProductSelect(it.id, e.target.value)} className="w-full border border-card-border bg-transparent text-foreground rounded p-2 text-sm outline-none focus:ring-1 focus:ring-foreground" placeholder="Product description" /></td>
                <td className="p-2"><input type="number" min={0} value={it.qty} onChange={e => setItems(items.map(i => i.id === it.id ? { ...i, qty: parseFloat(e.target.value)||0 } : i))} className="w-full border border-card-border bg-transparent text-foreground rounded p-2 text-sm text-right outline-none focus:ring-1 focus:ring-foreground" /></td>
                <td className="p-2"><input type="number" min={0} value={it.estCost} onChange={e => setItems(items.map(i => i.id === it.id ? { ...i, estCost: parseFloat(e.target.value)||0 } : i))} className="w-full border border-card-border bg-transparent text-foreground rounded p-2 text-sm text-right outline-none focus:ring-1 focus:ring-foreground" placeholder="Est Cost" /></td>
                <td className="p-2"><input type="number" min={0} value={it.rate} onChange={e => setItems(items.map(i => i.id === it.id ? { ...i, rate: parseFloat(e.target.value)||0 } : i))} className="w-full border border-card-border bg-transparent text-foreground rounded p-2 text-sm text-right outline-none focus:ring-1 focus:ring-foreground" /></td>
                <td className="p-2 text-right font-bold text-foreground">{formatCurrency(it.qty * it.rate)}</td>
                <td className="p-2 text-center">
                  <div className={`text-xs font-bold ${marginPct > 15 ? 'text-emerald-500' : marginPct > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                    {marginPct.toFixed(1)}%
                  </div>
                </td>
                <td className="p-2 text-center">
                  <button onClick={() => setItems(items.filter(i => i.id !== it.id))} className="text-muted-foreground hover:text-rose-500 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 size={16} /></button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        <button onClick={() => { setItems([...items, { id: nextItemId, brand: "", desc: "", qty: 1, rate: 0, estCost: 0 }]); setNextItemId(nextItemId + 1) }} className="mt-4 w-full py-3 border border-dashed border-card-border rounded-xl text-muted-foreground font-semibold text-sm hover:border-accent hover:text-foreground hover:bg-muted/50 flex items-center justify-center gap-2 transition-colors">
          <PlusCircle size={18} /> Add line item
        </button>
      </div>

      {/* Terms & Conditions */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-card-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-muted border border-card-border rounded-lg flex items-center justify-center text-foreground/70"><ClipboardCheck size={16} /></div>
            <div className="text-xs font-bold text-foreground uppercase tracking-widest">Terms & Conditions</div>
          </div>
          <div className="text-[10px] text-muted-foreground">Click to edit · Use arrows to reorder</div>
        </div>

        <ul className="space-y-2 mb-4">
          {tcs.map((tc, idx) => (
            <li key={tc.id} className="flex items-center gap-2 p-2 border border-card-border rounded-lg bg-muted/30 hover:border-accent/20 transition-colors">
              <div className="w-6 h-6 flex-shrink-0 bg-background border border-card-border rounded-full flex items-center justify-center text-[10px] font-bold text-muted-foreground">{idx + 1}</div>
              <input value={tc.label} onChange={e => setTcs(tcs.map(t => t.id === tc.id ? { ...t, label: e.target.value } : t))} className="w-32 flex-shrink-0 border border-card-border rounded p-1.5 text-xs font-bold text-foreground outline-none focus:ring-1 focus:ring-foreground bg-background" placeholder="Label" />
              <input value={tc.value} onChange={e => setTcs(tcs.map(t => t.id === tc.id ? { ...t, value: e.target.value } : t))} className="flex-1 border border-card-border rounded p-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-foreground bg-background" placeholder="Term value..." />
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => { if(idx>0) { const newTcs = [...tcs]; [newTcs[idx-1], newTcs[idx]] = [newTcs[idx], newTcs[idx-1]]; setTcs(newTcs); } }} className={`p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground ${idx===0 && 'opacity-30 pointer-events-none'}`}><ChevronUp size={16} /></button>
                <button onClick={() => { if(idx<tcs.length-1) { const newTcs = [...tcs]; [newTcs[idx+1], newTcs[idx]] = [newTcs[idx], newTcs[idx+1]]; setTcs(newTcs); } }} className={`p-1 rounded text-muted-foreground hover:bg-muted hover:text-foreground ${idx===tcs.length-1 && 'opacity-30 pointer-events-none'}`}><ChevronDown size={16} /></button>
                <button onClick={() => setTcs(tcs.filter(t => t.id !== tc.id))} className="p-1 rounded text-muted-foreground hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 pt-2 border-t border-card-border">
          <input value={newTcLabel} onChange={e => setNewTcLabel(e.target.value)} className="w-[164px] border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-foreground" placeholder="Label (e.g. Warranty)" />
          <input value={newTcValue} onChange={e => setNewTcValue(e.target.value)} onKeyDown={e => { if(e.key === 'Enter') { if(newTcValue) { setTcs([...tcs, {id: nextTcId, label: newTcLabel || 'Term', value: newTcValue}]); setNextTcId(nextTcId+1); setNewTcLabel(""); setNewTcValue(""); } } }} className="flex-1 border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-foreground" placeholder="Term value..." />
          <button onClick={() => { if(newTcValue) { setTcs([...tcs, {id: nextTcId, label: newTcLabel || 'Term', value: newTcValue}]); setNextTcId(nextTcId+1); setNewTcLabel(""); setNewTcValue(""); } }} className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold rounded-lg px-4 py-2.5 text-sm flex items-center gap-2">
            <PlusCircle size={16} /> Add Term
          </button>
        </div>
      </div>

      {/* Hidden PDF Preview Element */}
      <div className={`mt-8 bg-gray-200 p-8 rounded-xl ${showPreview ? 'block' : 'hidden'}`}>
        <div ref={previewRef} className="bg-white mx-auto text-black p-0 overflow-hidden shadow-2xl" style={{ width: "794px", fontFamily: "'Inter', sans-serif" }}>
          
          <div className="text-center py-6 px-11 border-b-2 border-red-600">
            <div className="font-serif text-[38px] font-black text-red-600 tracking-tight leading-none">Megatech Solutions</div>
            <div className="text-xs text-gray-600 mt-1 font-medium">(Your Premier IT Partner)</div>
          </div>
          
          <div className="py-5 px-11">
            <div className="text-center mb-3 mt-2">
              <span className="bg-gray-900 text-white text-[11.5px] font-bold tracking-[3px] px-8 py-1.5 uppercase">Quotation</span>
            </div>
            
            <div className="flex justify-between text-[11px] leading-relaxed mb-3">
              <div>
                <b>To,</b><br/>
                <span className="text-[13px] font-bold text-red-600" dangerouslySetInnerHTML={{ __html: (customerAddress || "___________").replace(/\n/g, '<br>') }} />
              </div>
              <div className="text-right">
                <b>Date:</b> {formatDate(new Date(date))}
              </div>
            </div>
            
            <div className="flex justify-between text-[11px] mb-3">
              <div><b>Subject / Ref:</b> {subject || '—'}</div>
              <div><b>Quotation No.:</b> {qno || '—'}</div>
            </div>
            
            <div className="text-[12px] text-gray-800 leading-relaxed mb-3">
              <span>{salutation}</span><br/><br/>
              Thank you for your valuable enquiry. With reference to your requirement, we are pleased to submit our best quotation for your kind consideration.
            </div>
            
            <table className="w-full text-[11px] mb-3 border-collapse">
              <thead>
                <tr>
                  <th className="bg-gray-900 text-white p-2 font-semibold text-left border-b border-gray-200 w-8">Sr.</th>
                  <th className="bg-gray-900 text-white p-2 font-semibold text-left border-b border-gray-200 w-[18%]">Brand / Company</th>
                  <th className="bg-gray-900 text-white p-2 font-semibold text-left border-b border-gray-200">Product Description</th>
                  <th className="bg-gray-900 text-white p-2 font-semibold text-right border-b border-gray-200 w-12">Qty</th>
                  <th className="bg-gray-900 text-white p-2 font-semibold text-right border-b border-gray-200 w-20">Rate (₹)</th>
                  <th className="bg-gray-900 text-white p-2 font-semibold text-right border-b border-gray-200 w-24">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={6} className="text-center p-4 text-gray-400">No items added</td></tr>
                ) : items.map((it, idx) => (
                  <tr key={it.id} className="even:bg-gray-50">
                    <td className="p-2 border-b border-gray-100">{idx + 1}</td>
                    <td className="p-2 border-b border-gray-100">{it.brand || '—'}</td>
                    <td className="p-2 border-b border-gray-100">{it.desc || '—'}</td>
                    <td className="p-2 border-b border-gray-100 text-right">{it.qty}</td>
                    <td className="p-2 border-b border-gray-100 text-right">{formatCurrency(it.rate)}</td>
                    <td className="p-2 border-b border-gray-100 text-right">{formatCurrency(it.qty * it.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="flex justify-end mb-4">
              <table className="text-[11px] border border-gray-200 rounded min-w-[220px]">
                <tbody>
                  <tr><td className="p-1.5 px-3 border-b border-gray-200">Subtotal</td><td className="p-1.5 px-3 border-b border-gray-200 text-right min-w-[110px]">{formatCurrency(subtotal)}</td></tr>
                  {gstOn && <tr><td className="p-1.5 px-3 border-b border-gray-200">GST ({gstPct}%)</td><td className="p-1.5 px-3 border-b border-gray-200 text-right min-w-[110px]">{formatCurrency(gstAmount)}</td></tr>}
                  {frOn && <tr><td className="p-1.5 px-3 border-b border-gray-200">Freight</td><td className="p-1.5 px-3 border-b border-gray-200 text-right min-w-[110px]">{formatCurrency(freight)}</td></tr>}
                  <tr className="bg-gray-900 text-white font-bold text-xs"><td className="p-1.5 px-3">Grand Total</td><td className="p-1.5 px-3 text-right min-w-[110px]">{formatCurrency(grandTotal)}</td></tr>
                </tbody>
              </table>
            </div>
            
            <div className="text-[12px] text-gray-800 leading-relaxed mb-3">
              We look forward to receiving your valuable Purchase Order and the opportunity to serve your organization.
            </div>
            
            <div className="bg-gray-50 border-l-[3px] border-red-600 p-3 rounded-r text-[10.5px] leading-loose mb-3 text-gray-800">
              <b className="text-red-600 text-[11px]">Terms & Conditions:</b><br/>
              <div className="mt-1">
                {tcs.map((tc, i) => (
                  <div key={tc.id}><b>{i + 1}. {tc.label}:</b> {tc.value}</div>
                ))}
              </div>
            </div>
            
            <div className="text-[12px] text-gray-800 leading-relaxed mb-3">
              Thanking you and assuring you of our best attention and services at all times.
            </div>
            
            <div className="flex justify-between pt-3 border-t border-gray-200 text-[11px] leading-relaxed">
              <div>
                <b className="text-red-600 text-[12px]">For Megatech Solutions</b><br/><br/>
                <br/>_________________________<br/>
                <b>Jatin Pachal</b><br/>Director<br/>
                <span className="text-gray-400 text-[10px]">Stamp & Signature</span>
              </div>
              <div></div>
            </div>
            
          </div>
          
          <div className="border-t-[1.5px] border-gray-300 p-2.5 px-11 text-center text-[9.5px] text-gray-500 leading-relaxed bg-gray-50">
            Regd. Office : 603, Shriram Complex, Near Nehru Statue, Sakri Road, Dhule 424 001. &nbsp;Tel. 02562-357620<br/>
            Mumbai Office : 15, Raja House, M.K.Amin Marg, Behind Central Camera, Fort, Mumbai 400 001. &nbsp;Tel.: 022-22702211<br/>
            email: jatin@megatechsolutions.co.in &nbsp;|&nbsp; Website: www.megatechsolutions.co.in &nbsp;|&nbsp; Cell: 9423191703, 9423191706
          </div>
          
        </div>
      </div>

    </div>
  )
}
