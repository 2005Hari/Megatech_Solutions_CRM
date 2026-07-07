"use client"

import { useState } from "react"
import { uploadCustomerPO } from "../actions/quotations"
import { Upload } from "lucide-react"
import { useRouter } from "next/navigation"

interface PendingQuotation {
  id: string
  refNo: string
  customer: {
    name: string
  } | null
}

export default function UploadCPOFromQuotationsModal({ pendingQuotations }: { pendingQuotations: PendingQuotation[] }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedQuotationId, setSelectedQuotationId] = useState("")
  const [cpoRefNo, setCpoRefNo] = useState("")
  const [cpoDate, setCpoDate] = useState(new Date().toISOString().split("T")[0])
  const [pdfFileName, setPdfFileName] = useState("")
  const [loading, setLoading] = useState(false)

  const selectedQuotation = pendingQuotations.find(q => q.id === selectedQuotationId)

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedQuotationId || !cpoRefNo || !pdfFileName) {
      return alert("Please select a quotation, fill all fields, and attach a file.")
    }
    setLoading(true)
    try {
      await uploadCustomerPO(selectedQuotationId, cpoRefNo, cpoDate, pdfFileName)
      setIsOpen(false)
      setSelectedQuotationId("")
      setCpoRefNo("")
      setPdfFileName("")
      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to upload CPO")
    }
    setLoading(false)
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-accent hover:bg-accent/90 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors inline-flex items-center gap-2 cursor-pointer"
      >
        <Upload size={16} /> Upload Customer PO
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-xl shadow-xl w-full max-w-md overflow-hidden text-left">
            <div className="px-6 py-4 border-b border-card-border flex justify-between items-center bg-muted/10">
              <h3 className="font-bold text-lg text-foreground">Upload Customer PO</h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground text-lg cursor-pointer transition-colors">✕</button>
            </div>
            
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5">Select Quotation</label>
                <select 
                  value={selectedQuotationId} 
                  onChange={e => setSelectedQuotationId(e.target.value)}
                  className="w-full px-3 py-2 border border-card-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-foreground cursor-pointer"
                  required
                >
                  <option value="">-- Select Quotation --</option>
                  {pendingQuotations.map(q => (
                    <option key={q.id} value={q.id}>
                      {q.refNo} ({q.customer?.name || "Manual Entry"})
                    </option>
                  ))}
                </select>
              </div>

              {selectedQuotation && (
                <div className="bg-accent/10 border border-accent/20 text-accent p-3 rounded-lg text-xs">
                  Linking CPO to quotation <strong className="font-semibold">{selectedQuotation.refNo}</strong> for <strong className="font-semibold">{selectedQuotation.customer?.name || "Manual Entry"}</strong>.
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5">CPO Reference Number</label>
                <input 
                  type="text" 
                  value={cpoRefNo}
                  onChange={e => setCpoRefNo(e.target.value)}
                  className="w-full px-3 py-2 border border-card-border rounded-lg text-sm bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  placeholder="e.g. PO-2024-999"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5">CPO Date</label>
                <input 
                  type="date" 
                  value={cpoDate}
                  onChange={e => setCpoDate(e.target.value)}
                  className="w-full px-3 py-2 border border-card-border rounded-lg text-sm bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5">CPO PDF Document</label>
                <div className="border-2 border-dashed border-card-border rounded-lg p-6 text-center hover:bg-muted/30 cursor-pointer relative transition-colors">
                  <input 
                    type="file" 
                    accept=".pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={e => setPdfFileName(e.target.files?.[0]?.name || "")}
                    required
                  />
                  {pdfFileName ? (
                    <div className="text-sm font-semibold text-foreground truncate">{pdfFileName}</div>
                  ) : (
                    <>
                      <Upload className="mx-auto text-muted-foreground mb-2" size={24} />
                      <div className="text-sm text-muted-foreground font-medium">Click or drag PDF to upload</div>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-card-border mt-6">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-medium text-foreground border border-transparent hover:border-card-border hover:bg-muted rounded-lg cursor-pointer transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-semibold text-accent-foreground bg-accent hover:bg-accent/90 rounded-lg disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer transition-colors">
                  {loading ? 'Processing...' : 'Save & Convert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
