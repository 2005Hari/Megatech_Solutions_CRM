"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { createQuotation, updateQuotation } from "@/app/actions/quotations"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Save, Eye, Download, User, FileText, List, Trash2, PlusCircle, ClipboardCheck, ChevronUp, ChevronDown, Plus } from "lucide-react"

export default function QuotationBuilder({ 
  products,
  services = [],
  units = [],
  initialQuotation
}: { 
  products: any[]
  services?: any[]
  units?: any[]
  initialQuotation?: any
}) {
  const router = useRouter()
  
  // State Initialization
  const [customerAddress, setCustomerAddress] = useState(initialQuotation?.customerAddress || "")
  const [salutation, setSalutation] = useState(initialQuotation?.salutation || "Dear Sir / Madam,")
  const [subject, setSubject] = useState(initialQuotation?.subject || "")
  const [qno, setQno] = useState(initialQuotation?.refNo || `MTS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`)
  const [date, setDate] = useState(initialQuotation?.date ? new Date(initialQuotation.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0])
  const [validUntil, setValidUntil] = useState(initialQuotation?.validUntil ? new Date(initialQuotation.validUntil).toISOString().split("T")[0] : "")
  const [quotationType, setQuotationType] = useState<"PRODUCT"|"SERVICE"|"MIXED">(initialQuotation?.type || "PRODUCT")
  
  // State for items that are NOT in any section
  const [items, setItems] = useState<any[]>(
    initialQuotation?.items?.filter((i: any) => !i.sectionId).map((i: any) => ({
      ...i, desc: i.productName, rate: i.sellPrice, estCost: i.estimatedCost || 0
    })) || [
      { id: '1', type: "PRODUCT", brand: "", desc: "", qty: 1, rate: 0, estCost: 0, laborCost: 0, materialCost: 0, transportCost: 0, otherCost: 0, order: 0 }
    ]
  )
  
  const [sections, setSections] = useState<any[]>(
    initialQuotation?.sections?.map((s: any) => ({
      ...s,
      items: s.items.map((i: any) => ({
        ...i, desc: i.productName, rate: i.sellPrice, estCost: i.estimatedCost || 0
      }))
    })) || []
  )
  
  const [gstOn, setGstOn] = useState(initialQuotation ? initialQuotation.includeGst : true)
  const [gstPct, setGstPct] = useState(initialQuotation?.gstPct || 18)
  const [frOn, setFrOn] = useState(initialQuotation ? initialQuotation.includeFreight : true)
  const [freight, setFreight] = useState(initialQuotation?.freightAmount || 0)

  const [tcs, setTcs] = useState<{id: any, label: string, value: string}[]>(() => {
    if (initialQuotation?.terms) {
      try { return JSON.parse(initialQuotation.terms) } catch (e) {}
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
  const getAllItems = () => {
    let all: any[] = [...items];
    sections.forEach(s => all = all.concat(s.items));
    return all;
  }
  
  const allItems = getAllItems();
  const subtotal = allItems.reduce((sum, item) => sum + (item.qty * (item.rate || 0)), 0)
  const gstAmount = gstOn ? subtotal * (gstPct / 100) : 0
  const frAmount = frOn ? freight : 0
  const grandTotal = subtotal + gstAmount + frAmount

  // Handlers
  const handleItemSelect = (desc: string, itemObj: any, setItemState: (i: any) => void) => {
    const prod = products.find(p => p.desc === desc)
    const serv = services.find(s => s.name === desc)
    
    if (prod) {
      setItemState({ ...itemObj, type: 'PRODUCT', desc: prod.desc, brand: prod.brand, rate: prod.rate })
    } else if (serv) {
      setItemState({ ...itemObj, type: 'SERVICE', desc: serv.name + (serv.description ? '\n' + serv.description : ''), rate: serv.defaultRate, unit: serv.defaultUnit })
    } else {
      setItemState({ ...itemObj, desc })
    }
  }

  const handleSave = async () => {
    if (!qno) return alert("Quotation number required.")
    
    setSaving(true)
    try {
      const payload = {
        customerId: initialQuotation?.customerId || undefined,
        refNo: qno,
        date,
        validUntil: validUntil || undefined,
        salutation,
        subject,
        type: quotationType,
        includeGst: gstOn,
        gstPct,
        includeFreight: frOn,
        freightAmount: frAmount,
        terms: JSON.stringify(tcs),
        items: items.filter(i => i.desc).map((i, idx) => ({
          id: typeof i.id === "string" ? i.id : undefined,
          type: i.type,
          brand: i.brand || "",
          productName: i.desc,
          qty: i.qty,
          unit: i.unit || "Nos",
          sellPrice: i.rate,
          estimatedCost: i.estCost || 0,
          laborCost: i.laborCost || 0,
          materialCost: i.materialCost || 0,
          transportCost: i.transportCost || 0,
          otherCost: i.otherCost || 0,
          order: idx
        })),
        sections: sections.map((s, sIdx) => ({
          id: typeof s.id === "string" ? s.id : undefined,
          name: s.name,
          order: sIdx,
          items: s.items.filter((i:any) => i.desc).map((i:any, idx:number) => ({
            id: typeof i.id === "string" ? i.id : undefined,
            type: i.type,
            brand: i.brand || "",
            productName: i.desc,
            qty: i.qty,
            unit: i.unit || "Nos",
            sellPrice: i.rate,
            estimatedCost: i.estCost || 0,
            laborCost: i.laborCost || 0,
            materialCost: i.materialCost || 0,
            transportCost: i.transportCost || 0,
            otherCost: i.otherCost || 0,
            order: idx
          }))
        }))
      }

      if (initialQuotation) {
        await updateQuotation(initialQuotation.id, payload as any)
        alert("Quotation updated successfully!")
        router.push(`/quotations/${initialQuotation.id}`)
      } else {
        await createQuotation(payload as any)
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

      const canvas = await html2canvas(previewRef.current, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" })
      previewRef.current.style.display = prevDisplay

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
      const imgProps = pdf.getImageProperties(imgData)
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`Megatech_${qno.replace(/\//g, '-')}.pdf`)
    } catch (e) {
      alert("Failed to generate PDF.")
    }
  }

  const renderItemTable = (targetItems: any[], setTargetItems: (newItems: any[]) => void, hideHeader = false) => (
    <div className="w-full">
      <table className="w-full text-sm text-left border-collapse">
        {!hideHeader && <thead>
          <tr className="bg-muted/50 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-card-border">
            <th className="p-2 w-10 text-center">Sr.</th>
            <th className="p-2 w-24">Type</th>
            <th className="p-2">Description</th>
            <th className="p-2 w-16 text-right">Qty</th>
            <th className="p-2 w-20">Unit</th>
            <th className="p-2 w-24 text-right">Rate</th>
            <th className="p-2 w-24 text-right">Amount</th>
            <th className="p-2 w-10"></th>
          </tr>
        </thead>}
        <tbody>
          {targetItems.map((it, idx) => (
            <tr key={it.id || idx} className="border-b border-card-border last:border-0 hover:bg-muted/30">
              <td className="p-2 text-center text-xs font-bold text-muted-foreground">{idx + 1}</td>
              <td className="p-2">
                <select value={it.type} onChange={e => setTargetItems(targetItems.map(i => i.id === it.id ? { ...i, type: e.target.value } : i))} className="w-full border border-card-border bg-transparent text-foreground rounded p-2 text-xs outline-none">
                  <option value="PRODUCT">Product</option>
                  <option value="SERVICE">Service</option>
                </select>
              </td>
              <td className="p-2">
                <div className="flex flex-col gap-1">
                  {it.type === 'PRODUCT' && <input value={it.brand || ""} onChange={e => setTargetItems(targetItems.map(i => i.id === it.id ? { ...i, brand: e.target.value } : i))} className="w-full border border-card-border bg-transparent text-foreground rounded p-2 text-xs outline-none" placeholder="Brand" />}
                  <textarea value={it.desc} onChange={e => handleItemSelect(e.target.value, it, (newItem) => setTargetItems(targetItems.map(i => i.id === it.id ? newItem : i)))} rows={2} className="w-full border border-card-border bg-transparent text-foreground rounded p-2 text-sm outline-none resize-y" placeholder="Product / Service Description" />
                </div>
              </td>
              <td className="p-2"><input type="number" min={0} value={it.qty} onChange={e => setTargetItems(targetItems.map(i => i.id === it.id ? { ...i, qty: parseFloat(e.target.value)||0 } : i))} className="w-full border border-card-border bg-transparent text-foreground rounded p-2 text-sm text-right outline-none" /></td>
              <td className="p-2">
                <input list="dl_units" value={it.unit || ""} onChange={e => setTargetItems(targetItems.map(i => i.id === it.id ? { ...i, unit: e.target.value } : i))} className="w-full border border-card-border bg-transparent text-foreground rounded p-2 text-sm outline-none" placeholder="Nos" />
              </td>
              <td className="p-2"><input type="number" min={0} value={it.rate} onChange={e => setTargetItems(targetItems.map(i => i.id === it.id ? { ...i, rate: parseFloat(e.target.value)||0 } : i))} className="w-full border border-card-border bg-transparent text-foreground rounded p-2 text-sm text-right outline-none" /></td>
              <td className="p-2 text-right font-bold text-foreground">{formatCurrency(it.qty * it.rate)}</td>
              <td className="p-2 text-center">
                <button onClick={() => setTargetItems(targetItems.filter(i => i.id !== it.id))} className="text-muted-foreground hover:text-rose-500 p-1 rounded hover:bg-rose-50"><Trash2 size={16} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2">
        <button onClick={() => setTargetItems([...targetItems, { id: Math.random().toString(), type: quotationType === "SERVICE" ? "SERVICE" : "PRODUCT", brand: "", desc: "", qty: 1, rate: 0, estCost: 0, order: targetItems.length }])} className="text-xs font-bold text-accent hover:underline flex items-center gap-1"><Plus size={12}/> Add Item</button>
      </div>
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <datalist id="dl_units">
        {units.map(u => <option key={u.id} value={u.name} />)}
      </datalist>

      {/* Topbar */}
      <div className="bg-card border border-card-border rounded-xl p-4 flex justify-between items-center mb-6 shadow-sm">
        <div>
          <div className="font-serif text-accent text-xl font-black tracking-tight leading-none">Megatech Solutions</div>
          <div className="text-muted-foreground text-xs mt-1 tracking-wider">Universal Quotation Engine</div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 border border-card-border rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-muted transition-colors">
            <Save size={16} /> {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={() => setShowPreview(!showPreview)} className="px-4 py-2 border border-card-border rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-muted transition-colors">
            <Eye size={16} /> {showPreview ? "Hide Preview" : "Preview"}
          </button>
          <button onClick={handleDownloadPDF} className="px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-accent/90 transition-colors">
            <Download size={16} /> Download PDF
          </button>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-4 mb-4 flex gap-4 items-center">
        <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Quotation Type:</span>
        <select value={quotationType} onChange={e => setQuotationType(e.target.value as any)} className="border border-card-border bg-transparent text-foreground rounded p-2 text-sm font-bold">
          <option value="PRODUCT">Product Supply</option>
          <option value="SERVICE">Service / Installation</option>
          <option value="MIXED">Mixed (Products + Services)</option>
        </select>
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
              <textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} rows={4} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm outline-none resize-y" placeholder="e.g. ABC Pvt. Ltd." />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1.5">Salutation</label>
              <input value={salutation} onChange={e => setSalutation(e.target.value)} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1.5">Subject / Reference</label>
                <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm outline-none" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1.5">Quotation No.</label>
                <input value={qno} onChange={e => setQno(e.target.value)} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm outline-none" />
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
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm outline-none" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1.5">Valid Until</label>
              <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm outline-none" />
            </div>
          </div>

          <div className="border border-card-border rounded-xl overflow-hidden">
            <div className="flex justify-between items-center p-3 text-sm border-b border-card-border bg-card">
              <span className="font-semibold text-muted-foreground">Subtotal</span>
              <span className="font-bold text-foreground">{formatCurrency(subtotal)}</span>
            </div>
            <div className="p-3 bg-muted/50 border-b border-card-border flex gap-3">
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer rounded-full px-3 py-1.5 border transition-colors bg-accent text-accent-foreground border-accent"><input type="checkbox" checked={gstOn} onChange={e => setGstOn(e.target.checked)} className="accent-foreground" /> Include GST</label>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer rounded-full px-3 py-1.5 border transition-colors bg-accent text-accent-foreground border-accent"><input type="checkbox" checked={frOn} onChange={e => setFrOn(e.target.checked)} className="accent-foreground" /> Include Freight</label>
            </div>
            <div className="flex justify-between items-center p-4 text-base bg-accent text-accent-foreground font-bold">
              <span>Grand Total</span>
              <span className="text-lg">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sections and Items */}
      <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm mb-4">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-card-border justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-muted border border-card-border rounded-lg flex items-center justify-center"><List size={16} /></div>
            <div className="text-xs font-bold uppercase tracking-widest">Line Items</div>
          </div>
          <button onClick={() => setSections([...sections, { id: Math.random().toString(), name: "New Section", items: [] }])} className="text-xs font-bold text-accent bg-accent/10 px-3 py-1.5 rounded-full">+ Add Section</button>
        </div>

        <div className="space-y-6">
          {sections.map((sec, sIdx) => (
            <div key={sec.id} className="border border-card-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 p-2 flex justify-between items-center border-b border-card-border">
                <input value={sec.name} onChange={e => setSections(sections.map(s => s.id === sec.id ? { ...s, name: e.target.value } : s))} className="font-bold text-sm bg-transparent outline-none w-1/2 px-2" placeholder="Section Name" />
                <button onClick={() => setSections(sections.filter(s => s.id !== sec.id))} className="text-rose-500 hover:bg-rose-50 p-1 rounded"><Trash2 size={14}/></button>
              </div>
              {renderItemTable(sec.items, (newItems) => setSections(sections.map(s => s.id === sec.id ? { ...s, items: newItems } : s)))}
            </div>
          ))}

          {renderItemTable(items, setItems, sections.length > 0)}
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
            
            <table className="w-full text-[11px] mb-3 border-collapse">
              <thead>
                <tr>
                  <th className="bg-gray-900 text-white p-2 font-semibold text-left border-b border-gray-200 w-8">Sr.</th>
                  <th className="bg-gray-900 text-white p-2 font-semibold text-left border-b border-gray-200">Description</th>
                  <th className="bg-gray-900 text-white p-2 font-semibold text-right border-b border-gray-200 w-12">Qty</th>
                  <th className="bg-gray-900 text-white p-2 font-semibold text-right border-b border-gray-200 w-20">Rate (₹)</th>
                  <th className="bg-gray-900 text-white p-2 font-semibold text-right border-b border-gray-200 w-24">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {sections.map(sec => (
                  <tr key={sec.id}>
                    <td colSpan={5} className="bg-gray-100 p-2 font-bold">{sec.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
