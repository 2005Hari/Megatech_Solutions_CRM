"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Prisma } from "@prisma/client"
import { PlusCircle, Save, Trash2, UserPlus, X } from "lucide-react"
import { createSupplierInline, updateSupplierPO } from "@/app/actions/spo"
import { useFeedback } from "@/components/ui/Feedback"
import { spoTotalCost } from "@/lib/finance"
import { formatCurrency, toDateInput } from "@/lib/utils"
import { lineTotal } from "@/lib/totals"

type Spo = Prisma.SupplierPOGetPayload<{ include: { items: true; cpo: { include: { customer: true } } } }>
type Supplier = { id: string; name: string; contactDetails: string | null }

type Row = {
  key: string
  id?: string
  productName: string
  qty: number
  unit: string
  /** Empty string = not priced yet (saved as null, never as 0). */
  buyPrice: string
}

const input =
  "w-full border border-card-border bg-transparent text-foreground rounded-lg p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
const label = "block text-[11px] font-bold text-muted-foreground uppercase mb-1.5"

let rowSeq = 0
const nextKey = () => `r${++rowSeq}`

export default function SPOEditForm({ spo, suppliers: initialSuppliers }: { spo: Spo; suppliers: Supplier[] }) {
  const router = useRouter()
  const { notify } = useFeedback()

  const [refNo, setRefNo] = useState(spo.refNo)
  const [date, setDate] = useState(toDateInput(spo.date))
  const [deliveryDate, setDeliveryDate] = useState(spo.deliveryDate ? toDateInput(spo.deliveryDate) : "")
  const [notes, setNotes] = useState(spo.notes ?? "")
  const [supplierId, setSupplierId] = useState(spo.supplierId ?? "")
  const [rows, setRows] = useState<Row[]>(() =>
    spo.items.map(i => ({
      key: nextKey(),
      id: i.id,
      productName: i.productName,
      qty: i.qty,
      unit: i.unit ?? "nos",
      buyPrice: typeof i.buyPrice === "number" && i.buyPrice > 0 ? String(i.buyPrice) : "",
    })),
  )

  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierContact, setNewSupplierContact] = useState("")
  const [saving, setSaving] = useState(false)
  const [creatingSupplier, setCreatingSupplier] = useState(false)

  const totalCost = spoTotalCost(rows.map(r => ({ qty: r.qty, buyPrice: r.buyPrice === "" ? null : Number(r.buyPrice) || 0 })))

  const patchRow = (key: string, patch: Partial<Row>) => setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)))

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingSupplier(true)
    try {
      const res = await createSupplierInline(newSupplierName, newSupplierContact)
      if (!notify(res, "Supplier created.")) return
      setSuppliers(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
      setSupplierId(res.data.id)
      setNewSupplierName("")
      setNewSupplierContact("")
      setShowSupplierModal(false)
    } finally {
      setCreatingSupplier(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await updateSupplierPO(spo.id, {
        refNo,
        date,
        deliveryDate: deliveryDate || undefined,
        notes: notes || undefined,
        supplierId: supplierId || undefined,
        items: rows.map(r => ({
          id: r.id,
          productName: r.productName,
          qty: r.qty,
          unit: r.unit || undefined,
          buyPrice: r.buyPrice === "" ? null : Number(r.buyPrice),
        })),
      })
      if (!notify(res, "Supplier PO saved.")) return
      router.push(`/spo/${spo.id}`)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card border border-card-border rounded-xl p-4 flex justify-between items-center shadow-sm">
          <div>
            <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Linked Customer PO</div>
            <div className="text-foreground font-mono font-bold mt-1 text-sm">
              {spo.cpo ? `${spo.cpo.refNo} (${spo.cpo.customer?.name || "Manual Entry"})` : "Standalone PO"}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold rounded-lg px-4 py-2 text-sm flex items-center gap-2 shadow-sm disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-card-border pb-3">Supplier &amp; Terms</h3>
            <div>
              <label htmlFor="supplier" className={label}>Supplier Profile</label>
              <div className="flex gap-2">
                <select id="supplier" value={supplierId} onChange={e => setSupplierId(e.target.value)} className={`${input} flex-1`}>
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(true)}
                  className="border border-card-border hover:bg-muted text-foreground px-3 rounded-lg text-sm flex items-center gap-1.5 font-medium transition-colors"
                  title="Add New Supplier"
                >
                  <UserPlus size={16} />
                  <span className="hidden sm:inline">Add New</span>
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="notes" className={label}>SPO Notes / Terms</label>
              <textarea
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className={`${input} resize-y`}
                placeholder="e.g. Delivery terms, payment guidelines, warranty specifications..."
              />
            </div>
          </div>

          <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-card-border pb-3">PO Details &amp; Dates</h3>
            <div>
              <label htmlFor="refno" className={label}>SPO Reference Number</label>
              <input id="refno" type="text" value={refNo} onChange={e => setRefNo(e.target.value)} className={input} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="date" className={label}>PO Date</label>
                <input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} className={input} required />
              </div>
              <div>
                <label htmlFor="delivery" className={label}>Delivery Date</label>
                <input id="delivery" type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className={input} />
              </div>
            </div>
            <div className="border border-card-border bg-muted/30 rounded-xl p-4 mt-6">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-muted-foreground">Total Purchase Cost</span>
                <span className="font-bold text-xl text-accent">{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-xl p-6 shadow-sm">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-card-border pb-3 mb-4">
            Products &amp; Buying Commercials
          </h3>

          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-card-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                <th className="p-3 w-10 text-center">Sr.</th>
                <th className="p-3">Product Description</th>
                <th className="p-3 w-24 text-right">Qty</th>
                <th className="p-3 w-28 text-left">Unit</th>
                <th className="p-3 w-32 text-right">Buy Price (₹)</th>
                <th className="p-3 w-32 text-right">Amount (₹)</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.key} className="border-b border-card-border last:border-0 hover:bg-muted/30">
                  <td className="p-2 text-center text-xs font-bold text-muted-foreground">{idx + 1}</td>
                  <td className="p-2">
                    <input
                      aria-label="Product description"
                      type="text"
                      value={r.productName}
                      onChange={e => patchRow(r.key, { productName: e.target.value })}
                      className={input}
                      placeholder="Product description..."
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      aria-label="Quantity"
                      type="number"
                      min={1}
                      step={1}
                      value={r.qty}
                      onChange={e => patchRow(r.key, { qty: Math.max(1, Math.floor(Number(e.target.value)) || 1) })}
                      className={`${input} text-right`}
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input aria-label="Unit" type="text" value={r.unit} onChange={e => patchRow(r.key, { unit: e.target.value })} className={input} placeholder="nos" />
                  </td>
                  <td className="p-2">
                    <input
                      aria-label="Buy price"
                      type="number"
                      min={0}
                      step="any"
                      value={r.buyPrice}
                      onChange={e => patchRow(r.key, { buyPrice: e.target.value })}
                      className={`${input} text-right font-medium`}
                      placeholder="Not priced"
                    />
                  </td>
                  <td className="p-2 text-right font-bold text-foreground">{formatCurrency(lineTotal(r.qty, Number(r.buyPrice) || 0))}</td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      aria-label="Remove product"
                      onClick={() => setRows(prev => prev.filter(x => x.key !== r.key))}
                      className="text-muted-foreground hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            onClick={() => setRows(prev => [...prev, { key: nextKey(), productName: "", qty: 1, unit: "nos", buyPrice: "" }])}
            className="mt-4 w-full py-3 border-2 border-dashed border-card-border rounded-xl text-muted-foreground font-bold text-sm hover:border-foreground/40 hover:text-foreground hover:bg-muted/30 flex items-center justify-center gap-2 transition-colors"
          >
            <PlusCircle size={18} /> Add Product Line Item
          </button>
        </div>
      </form>

      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="supplier-title" className="bg-card rounded-xl shadow-xl w-full max-w-md overflow-hidden text-left border border-card-border">
            <div className="px-6 py-4 border-b border-card-border flex justify-between items-center bg-muted/10">
              <h3 id="supplier-title" className="font-bold text-lg text-foreground">Add New Supplier</h3>
              <button type="button" aria-label="Close" onClick={() => setShowSupplierModal(false)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSupplier} className="p-6 space-y-4">
              <div>
                <label htmlFor="new-supplier" className={label}>Supplier Name</label>
                <input id="new-supplier" type="text" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className={input} placeholder="e.g. D-Link India Ltd." required />
              </div>
              <div>
                <label htmlFor="new-supplier-contact" className={label}>Contact Details / Address</label>
                <textarea id="new-supplier-contact" value={newSupplierContact} onChange={e => setNewSupplierContact(e.target.value)} className={`${input} resize-y`} rows={3} placeholder="Address, Phone, Email..." />
              </div>
              <div className="pt-4 flex gap-3 justify-end border-t border-card-border">
                <button type="button" onClick={() => setShowSupplierModal(false)} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg">
                  Cancel
                </button>
                <button type="submit" disabled={creatingSupplier} className="px-4 py-2 text-sm font-semibold text-accent-foreground bg-accent hover:bg-accent/90 rounded-lg disabled:opacity-50">
                  {creatingSupplier ? "Creating..." : "Create & Select"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
