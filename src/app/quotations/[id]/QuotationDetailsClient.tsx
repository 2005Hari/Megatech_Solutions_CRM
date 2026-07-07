"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Eye, Download, Edit, Calendar, Info, FileText, ClipboardCheck } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import UploadCPOModal from "../upload-cpo"
import DeleteQuotationButton from "../DeleteQuotationButton"

export default function QuotationDetailsClient({ quotation }: { quotation: any }) {
  const [showPreview, setShowPreview] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  // Calculations
  const subtotal = quotation.items.reduce((sum: number, item: any) => sum + (item.qty * item.sellPrice), 0)
  const gstPct = quotation.gstPct || 18
  const gstAmount = quotation.includeGst ? subtotal * (gstPct / 100) : 0
  const frAmount = quotation.includeFreight ? quotation.freightAmount : 0
  const grandTotal = subtotal + gstAmount + frAmount
  
  const totalExpectedCost = quotation.items.reduce((sum: number, item: any) => sum + (item.qty * (item.estimatedCost || 0)), 0)
  const expectedProfit = subtotal - totalExpectedCost
  const expectedMarginPct = subtotal > 0 ? (expectedProfit / subtotal) * 100 : 0

  // Terms and conditions parser
  let terms: { id: number; label: string; value: string }[] = []
  try {
    if (quotation.terms) {
      terms = JSON.parse(quotation.terms)
    }
  } catch (e) {
    console.error("Failed to parse terms JSON", e)
  }

  const handleDownloadPDF = async () => {
    try {
      const { jsPDF } = await import("jspdf")
      const html2canvas = (await import("html2canvas")).default

      if (!previewRef.current) return

      // Force block display during rendering
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
      pdf.save(`Megatech_${quotation.refNo.replace(/\//g, '-')}.pdf`)
    } catch (e) {
      console.error(e)
      alert("Failed to generate PDF.")
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* Top Controls */}
      <div className="bg-card border border-card-border rounded-xl p-4 flex justify-between items-center mb-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground text-base">{quotation.refNo}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${
              quotation.status === 'Won' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
              quotation.status === 'Lost' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
              'bg-amber-500/10 text-amber-500 border border-amber-500/20'
            }`}>
              {quotation.status}
            </span>
          </div>
          <div className="text-muted-foreground text-xs mt-1 font-medium">{quotation.customer?.name || "Manual Entry"}</div>
        </div>

        <div className="flex gap-2">
          {quotation.status === "Pending" && (
            <Link 
              href={`/quotations/${quotation.id}/edit`} 
              className="px-4 py-2 border border-card-border hover:bg-muted text-foreground rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit size={16} /> Edit Quotation
            </Link>
          )}
          <button 
            onClick={() => setShowPreview(!showPreview)} 
            className="px-4 py-2 border border-card-border hover:bg-muted text-foreground rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Eye size={16} /> {showPreview ? "Hide Document Preview" : "Document Preview"}
          </button>
          <button 
            onClick={handleDownloadPDF} 
            className="px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <Download size={16} /> Download PDF
          </button>
          {(quotation.status === "Pending" || quotation.status === "Won") && (
            <div className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg text-sm font-semibold flex items-center transition-colors cursor-pointer">
              <UploadCPOModal quotationId={quotation.id} quotationRef={quotation.refNo} customerName={quotation.customer?.name || "Manual Entry"} />
            </div>
          )}
          <div className="flex items-center">
            <DeleteQuotationButton quotationId={quotation.id} refNo={quotation.refNo} redirectTo="/quotations" className="px-4 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer" showText={true} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Details block */}
        <div className="col-span-2 space-y-6">
          {/* Metadata info */}
          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-card-border pb-3 flex items-center gap-2">
              <Info size={14} className="text-muted-foreground" /> Quotation Details
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
                  <span className="text-muted-foreground font-medium italic">"{quotation.salutation}"</span>
                </div>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-card border border-card-border rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-card-border bg-muted/30 flex items-center gap-2">
              <FileText size={14} className="text-muted-foreground" />
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Line Items</h3>
            </div>
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
              <tbody className="divide-y divide-card-border">
                {quotation.items.map((item: any, idx: number) => {
                  const estCost = item.estimatedCost || 0;
                  const marginAmt = item.sellPrice - estCost;
                  const marginPct = item.sellPrice > 0 ? (marginAmt / item.sellPrice) * 100 : 0;
                  return (
                  <tr key={item.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3.5 text-center text-xs font-bold text-muted-foreground">{idx + 1}</td>
                    <td className="px-5 py-3.5 font-medium text-foreground">{item.brand || "—"}</td>
                    <td className="px-5 py-3.5 font-semibold text-foreground">{item.productName}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-foreground">{item.qty}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-muted-foreground">{formatCurrency(estCost)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-foreground">{formatCurrency(item.sellPrice)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold">
                      <div className={marginPct >= 15 ? 'text-emerald-500' : marginPct > 0 ? 'text-amber-500' : 'text-rose-500'}>
                        {marginPct.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-foreground">{formatCurrency(item.qty * item.sellPrice)}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sidebar Summary & Terms */}
        <div className="col-span-1 space-y-6">
          {/* Totals Summary */}
          <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-card-border pb-3 flex items-center gap-2">
              <Calendar size={14} className="text-muted-foreground" /> Commercial Summary
            </h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-card-border pb-2">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
              </div>
              {quotation.includeGst && (
                <div className="flex justify-between border-b border-card-border pb-2">
                  <span className="text-muted-foreground">GST ({gstPct}%)</span>
                  <span className="font-semibold text-foreground">{formatCurrency(gstAmount)}</span>
                </div>
              )}
              {quotation.includeFreight && (
                <div className="flex justify-between border-b border-card-border pb-2">
                  <span className="text-muted-foreground">Freight</span>
                  <span className="font-semibold text-foreground">{formatCurrency(frAmount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-card-border mt-2">
                <span className="font-bold text-foreground">Grand Total</span>
                <span className="font-bold text-lg text-accent">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-card-border mt-2 bg-muted/20 p-2 rounded-lg">
                <span className="text-muted-foreground font-semibold">Expected Profit</span>
                <span className={`font-bold ${expectedProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {formatCurrency(expectedProfit)} ({expectedMarginPct.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Terms & Conditions */}
          {terms.length > 0 && (
            <div className="bg-card border border-card-border rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-card-border pb-3 flex items-center gap-2">
                <ClipboardCheck size={14} className="text-muted-foreground" /> Terms & Conditions
              </h3>
              <div className="space-y-3.5">
                {terms.map((tc, i) => (
                  <div key={tc.id} className="text-xs">
                    <span className="font-bold text-foreground block mb-0.5">{i + 1}. {tc.label}</span>
                    <span className="text-muted-foreground leading-relaxed font-medium">{tc.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden formal template for PDF print */}
      <div className={`mt-8 bg-slate-200 p-8 rounded-xl ${showPreview ? 'block' : 'hidden'}`}>
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
                <span className="text-[13px] font-bold text-red-600" dangerouslySetInnerHTML={{ __html: ((quotation.customer?.name || "Manual Entry") + "\n" + (quotation.customer?.contactDetails || "")).replace(/\n/g, '<br>') }} />
              </div>
              <div className="text-right">
                <b>Date:</b> {formatDate(new Date(quotation.date))}
              </div>
            </div>
            
            <div className="flex justify-between text-[11px] mb-3">
              <div><b>Subject / Ref:</b> {quotation.subject || '—'}</div>
              <div><b>Quotation No.:</b> {quotation.refNo || '—'}</div>
            </div>
            
            <div className="text-[12px] text-gray-800 leading-relaxed mb-3">
              <span>{quotation.salutation}</span><br/><br/>
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
                {quotation.items.map((it: any, idx: number) => (
                  <tr key={it.id} className="even:bg-gray-50">
                    <td className="p-2 border-b border-gray-100">{idx + 1}</td>
                    <td className="p-2 border-b border-gray-100">{it.brand || '—'}</td>
                    <td className="p-2 border-b border-gray-100">{it.productName || '—'}</td>
                    <td className="p-2 border-b border-gray-100 text-right">{it.qty}</td>
                    <td className="p-2 border-b border-gray-100 text-right">{formatCurrency(it.sellPrice)}</td>
                    <td className="p-2 border-b border-gray-100 text-right">{formatCurrency(it.qty * it.sellPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="flex justify-end mb-4">
              <table className="text-[11px] border border-gray-200 rounded min-w-[220px]">
                <tbody>
                  <tr><td className="p-1.5 px-3 border-b border-gray-200">Subtotal</td><td className="p-1.5 px-3 border-b border-gray-200 text-right min-w-[110px]">{formatCurrency(subtotal)}</td></tr>
                  {quotation.includeGst && <tr><td className="p-1.5 px-3 border-b border-gray-200">GST ({gstPct}%)</td><td className="p-1.5 px-3 border-b border-gray-200 text-right min-w-[110px]">{formatCurrency(gstAmount)}</td></tr>}
                  {quotation.includeFreight && <tr><td className="p-1.5 px-3 border-b border-gray-200">Freight</td><td className="p-1.5 px-3 border-b border-gray-200 text-right min-w-[110px]">{formatCurrency(frAmount)}</td></tr>}
                  <tr className="bg-gray-900 text-white font-bold text-xs"><td className="p-1.5 px-3">Grand Total</td><td className="p-1.5 px-3 text-right min-w-[110px]">{formatCurrency(grandTotal)}</td></tr>
                </tbody>
              </table>
            </div>
            
            <div className="text-[12px] text-gray-800 leading-relaxed mb-3">
              We look forward to receiving your valuable Purchase Order and the opportunity to serve your organization.
            </div>
            
            {terms.length > 0 && (
              <div className="bg-gray-50 border-l-[3px] border-red-600 p-3 rounded-r text-[10.5px] leading-loose mb-3 text-gray-800">
                <b className="text-red-600 text-[11px]">Terms & Conditions:</b><br/>
                <div className="mt-1">
                  {terms.map((tc, i) => (
                    <div key={tc.id}><b>{i + 1}. {tc.label}:</b> {tc.value}</div>
                  ))}
                </div>
              </div>
            )}
            
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
