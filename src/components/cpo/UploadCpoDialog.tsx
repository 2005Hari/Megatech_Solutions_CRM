"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, X } from "lucide-react"
import { uploadCustomerPO } from "@/app/actions/quotations"
import { useFeedback } from "@/components/ui/Feedback"
import { toDateInput } from "@/lib/utils"

export type ConvertibleQuotation = { id: string; refNo: string; customerName: string }

type Props = {
  open: boolean
  onClose: () => void
  quotations: ConvertibleQuotation[]
  /** When set the quotation is fixed; otherwise the user picks one. */
  quotationId?: string
}

const field =
  "w-full px-3 py-2 border border-card-border rounded-lg text-sm bg-transparent text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
const label = "block text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5"

export default function UploadCpoDialog({ open, onClose, quotations, quotationId }: Props) {
  const router = useRouter()
  const { notify } = useFeedback()
  const [selectedId, setSelectedId] = useState(quotationId ?? "")
  const [cpoRefNo, setCpoRefNo] = useState("")
  const [cpoDate, setCpoDate] = useState(() => toDateInput())
  const [pdfFileName, setPdfFileName] = useState("")
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const selected = quotations.find(q => q.id === (quotationId ?? selectedId))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setLoading(true)
    try {
      const res = await uploadCustomerPO(selected.id, cpoRefNo, cpoDate, pdfFileName)
      if (!notify(res, `Customer PO ${cpoRefNo.trim()} created.`)) return
      onClose()
      router.push(`/cpo/${res.data.id}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="cpo-title" className="bg-card border border-card-border rounded-xl shadow-xl w-full max-w-md overflow-hidden text-left">
        <div className="px-6 py-4 border-b border-card-border flex justify-between items-center bg-muted/10">
          <h3 id="cpo-title" className="font-bold text-lg text-foreground">Upload Customer PO</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {quotationId ? (
            selected && (
              <div className="bg-muted text-foreground p-3 rounded-lg text-sm border border-card-border">
                Creating CPO for <strong className="font-semibold">{selected.refNo}</strong> ({selected.customerName})
              </div>
            )
          ) : (
            <div>
              <label htmlFor="cpo-quotation" className={label}>Select Quotation</label>
              <select id="cpo-quotation" value={selectedId} onChange={e => setSelectedId(e.target.value)} className={field} required>
                <option value="">-- Select Quotation --</option>
                {quotations.map(q => (
                  <option key={q.id} value={q.id}>
                    {q.refNo} ({q.customerName})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="cpo-ref" className={label}>CPO Reference Number</label>
            <input id="cpo-ref" type="text" value={cpoRefNo} onChange={e => setCpoRefNo(e.target.value)} className={field} placeholder="e.g. PO-2024-999" required />
          </div>

          <div>
            <label htmlFor="cpo-date" className={label}>CPO Date</label>
            <input id="cpo-date" type="date" value={cpoDate} onChange={e => setCpoDate(e.target.value)} className={field} required />
          </div>

          <div>
            <label className={label}>CPO PDF Document</label>
            <div className="border-2 border-dashed border-card-border rounded-lg p-6 text-center hover:bg-muted/30 cursor-pointer relative transition-colors">
              <input
                type="file"
                accept=".pdf"
                aria-label="CPO PDF"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={e => setPdfFileName(e.target.files?.[0]?.name || "")}
                required
              />
              {pdfFileName ? (
                <div className="text-sm font-semibold text-foreground truncate">{pdfFileName}</div>
              ) : (
                <>
                  <Upload className="mx-auto text-muted-foreground mb-2" size={24} />
                  <div className="text-sm text-muted-foreground font-medium">Click or drag PDF to attach</div>
                </>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Only the file name is recorded against the order - the PDF itself is not stored here.
            </p>
          </div>

          <div className="pt-4 flex gap-3 justify-end border-t border-card-border mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground border border-transparent hover:border-card-border hover:bg-muted rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading || !selected} className="px-4 py-2 text-sm font-semibold text-accent-foreground bg-accent hover:bg-accent/90 rounded-lg disabled:opacity-50 transition-colors">
              {loading ? "Processing..." : "Save & Convert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
