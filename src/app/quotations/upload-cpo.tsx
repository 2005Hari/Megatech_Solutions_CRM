"use client"

import { useState } from "react"
import { uploadCustomerPO } from "../actions/quotations"
import { Upload } from "lucide-react"

export default function UploadCPOModal({ quotationId, quotationRef, customerName }: { quotationId: string, quotationRef: string, customerName: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [cpoRefNo, setCpoRefNo] = useState("")
  const [cpoDate, setCpoDate] = useState(new Date().toISOString().split("T")[0])
  const [pdfFileName, setPdfFileName] = useState("")
  const [loading, setLoading] = useState(false)

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cpoRefNo || !pdfFileName) return alert("Please fill all fields and attach a file.")
    setLoading(true)
    try {
      await uploadCustomerPO(quotationId, cpoRefNo, cpoDate, pdfFileName)
      setIsOpen(false)
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
        className="text-foreground hover:text-accent font-bold text-[11px] uppercase tracking-wider inline-flex items-center gap-1 transition-colors"
      >
        <Upload size={14} /> Upload CPO
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-card-border rounded-xl shadow-xl w-full max-w-md overflow-hidden text-left">
            <div className="px-6 py-4 border-b border-card-border flex justify-between items-center">
              <h3 className="font-bold text-lg text-foreground">Upload Customer PO</h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">✕</button>
            </div>
            
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              <div className="bg-muted text-foreground p-3 rounded-lg text-sm mb-4 border border-card-border">
                Creating CPO for <strong className="font-semibold">{quotationRef}</strong> ({customerName})
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">CPO Reference Number</label>
                <input 
                  type="text" 
                  value={cpoRefNo}
                  onChange={e => setCpoRefNo(e.target.value)}
                  className="w-full px-3 py-2 border border-card-border bg-transparent text-foreground rounded-md focus:outline-none focus:ring-1 focus:ring-foreground"
                  placeholder="e.g. PO-2024-999"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">CPO Date</label>
                <input 
                  type="date" 
                  value={cpoDate}
                  onChange={e => setCpoDate(e.target.value)}
                  className="w-full px-3 py-2 border border-card-border bg-transparent text-foreground rounded-md focus:outline-none focus:ring-1 focus:ring-foreground"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1 uppercase tracking-wider">CPO PDF Document</label>
                <div className="border-2 border-dashed border-card-border rounded-lg p-6 text-center hover:bg-muted/50 transition-colors cursor-pointer relative">
                  <input 
                    type="file" 
                    accept=".pdf"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={e => setPdfFileName(e.target.files?.[0]?.name || "")}
                    required
                  />
                  {pdfFileName ? (
                    <div className="text-sm font-medium text-foreground truncate">{pdfFileName}</div>
                  ) : (
                    <>
                      <Upload className="mx-auto text-muted-foreground mb-2" size={24} />
                      <div className="text-sm text-muted-foreground">Click or drag PDF to upload</div>
                    </>
                  )}
                </div>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-card-border mt-6">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors border border-transparent hover:border-card-border">Cancel</button>
                <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-accent-foreground bg-accent hover:bg-accent/90 rounded-lg disabled:opacity-50 inline-flex items-center gap-2 transition-colors">
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
