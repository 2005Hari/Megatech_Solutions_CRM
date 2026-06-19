"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateSupplierPO, createSupplierInline } from "@/app/actions/spo"
import { Save, PlusCircle, Trash2, UserPlus, X } from "lucide-react"
import { formatCurrency } from "@/lib/utils"

interface Supplier {
  id: string
  name: string
  contactDetails: string | null
}

interface SPOItem {
  id?: string
  productName: string
  qty: number
  unit: string | null
  buyPrice: number | null
}

export default function SPOEditForm({ spo, suppliers: initialSuppliers }: { spo: any; suppliers: Supplier[] }) {
  const router = useRouter()
  
  // Form State
  const [refNo, setRefNo] = useState(spo.refNo)
  const [date, setDate] = useState(spo.date ? new Date(spo.date).toISOString().split("T")[0] : "")
  const [deliveryDate, setDeliveryDate] = useState(spo.deliveryDate ? new Date(spo.deliveryDate).toISOString().split("T")[0] : "")
  const [notes, setNotes] = useState(spo.notes || "")
  const [supplierId, setSupplierId] = useState(spo.supplierId || "")
  const [items, setItems] = useState<SPOItem[]>(
    spo.items.map((i: any) => ({
      id: i.id,
      productName: i.productName,
      qty: i.qty,
      unit: i.unit,
      buyPrice: i.buyPrice || 0
    }))
  )

  // Supplier List State (to dynamically append new inline suppliers)
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers)

  // Inline Supplier Modal State
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [newSupplierName, setNewSupplierName] = useState("")
  const [newSupplierContact, setNewSupplierContact] = useState("")

  // Loading States
  const [saving, setSaving] = useState(false)
  const [creatingSupplier, setCreatingSupplier] = useState(false)

  // Calcs
  const totalCost = items.reduce((sum, item) => sum + (item.qty * (item.buyPrice || 0)), 0)

  // Handlers
  const handleAddItem = () => {
    setItems([...items, { productName: "", qty: 1, unit: "nos", buyPrice: 0 }])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index))
  }

  const handleItemChange = (index: number, field: keyof SPOItem, value: any) => {
    setItems(
      items.map((item, idx) => {
        if (idx === index) {
          return { ...item, [field]: value }
        }
        return item
      })
    )
  }

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSupplierName.trim()) return alert("Please enter supplier name")

    setCreatingSupplier(true)
    try {
      const newSupplier = await createSupplierInline(newSupplierName.trim(), newSupplierContact.trim())
      setSuppliers(prev => [...prev, newSupplier].sort((a, b) => a.name.localeCompare(b.name)))
      setSupplierId(newSupplier.id)
      setNewSupplierName("")
      setNewSupplierContact("")
      setShowSupplierModal(false)
    } catch (err: any) {
      alert("Failed to create supplier: " + err.message)
    } finally {
      setCreatingSupplier(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refNo.trim()) return alert("SPO Reference number is required")
    if (!date) return alert("SPO Date is required")
    if (items.some(i => !i.productName.trim())) return alert("Please fill descriptions for all products")

    setSaving(true)
    try {
      await updateSupplierPO(spo.id, {
        refNo: refNo.trim(),
        date,
        deliveryDate: deliveryDate || undefined,
        notes: notes.trim() || undefined,
        supplierId: supplierId || undefined,
        items: items.map(i => ({
          id: i.id,
          productName: i.productName,
          qty: i.qty,
          unit: i.unit || undefined,
          buyPrice: Number(i.buyPrice) || 0
        }))
      })
      router.push(`/spo/${spo.id}`)
      router.refresh()
    } catch (err: any) {
      alert("Failed to save Supplier PO: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Top bar info */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 flex justify-between items-center shadow-xs">
          <div>
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Linked Customer PO</div>
            <div className="text-slate-900 font-mono font-bold mt-1 text-sm">
              {spo.cpo ? `${spo.cpo.refNo} (${spo.cpo.customer.name})` : "Standalone PO"}
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg px-4 py-2 text-sm flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>

        {/* Info Forms */}
        <div className="grid grid-cols-2 gap-6">
          {/* Supplier and Notes */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">
              Supplier & Terms
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Supplier Profile</label>
              <div className="flex gap-2">
                <select
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 cursor-pointer"
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(true)}
                  className="border border-slate-300 hover:bg-slate-50 text-slate-600 p-2.5 rounded-lg text-sm flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
                  title="Add New Supplier"
                >
                  <UserPlus size={16} />
                  <span className="hidden sm:inline">Add New</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">SPO Notes / Terms</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={4}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-y"
                placeholder="e.g. Delivery terms, payment guidelines, warranty specifications..."
              />
            </div>
          </div>

          {/* Dates & Reference */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3">
              PO Details & Dates
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">SPO Reference Number</label>
              <input
                type="text"
                value={refNo}
                onChange={e => setRefNo(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="SPO Reference"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">PO Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 cursor-pointer"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Delivery Date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="border border-slate-100 bg-slate-50/50 rounded-xl p-4 mt-6">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-slate-600">Total Purchase Cost</span>
                <span className="font-bold text-xl text-red-600">{formatCurrency(totalCost)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-xs">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 mb-4">
            Products & Buying Commercials
          </h3>

          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
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
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="p-2 text-center text-xs font-bold text-slate-400">{idx + 1}</td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.productName}
                      onChange={e => handleItemChange(idx, "productName", e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      placeholder="Product description..."
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={e => handleItemChange(idx, "qty", parseInt(e.target.value) || 1)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm text-right focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      required
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={item.unit || "nos"}
                      onChange={e => handleItemChange(idx, "unit", e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      placeholder="nos"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={item.buyPrice || 0}
                      onChange={e => handleItemChange(idx, "buyPrice", parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-300 rounded-lg p-2 text-sm text-right font-medium focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                      required
                    />
                  </td>
                  <td className="p-2 text-right font-bold text-slate-800">
                    {formatCurrency(item.qty * (item.buyPrice || 0))}
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      title="Remove product"
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
            onClick={handleAddItem}
            className="mt-4 w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-bold text-sm hover:border-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <PlusCircle size={18} /> Add Product Line Item
          </button>
        </div>
      </form>

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden text-left border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-lg text-slate-900">Add New Supplier</h3>
              <button
                onClick={() => setShowSupplierModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Supplier Name</label>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={e => setNewSupplierName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="e.g. D-Link India Ltd."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Contact Details / Address</label>
                <textarea
                  value={newSupplierContact}
                  onChange={e => setNewSupplierContact(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-y"
                  rows={3}
                  placeholder="Address, Phone, Email..."
                />
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingSupplier}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-2 shadow-sm cursor-pointer"
                >
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
