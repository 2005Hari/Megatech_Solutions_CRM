"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createContact, updateContact } from "@/app/actions/contacts"
import { X, Save } from "lucide-react"

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
  type: "customer" | "supplier"
  contact?: {
    id: string
    name: string
    contactDetails: string | null
  } | null
}

export default function ContactModal({ isOpen, onClose, type, contact }: ContactModalProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [contactDetails, setContactDetails] = useState("")
  const [loading, setLoading] = useState(false)

  // Prepopulate form if contact is provided (Edit Mode)
  useEffect(() => {
    if (contact) {
      setName(contact.name)
      setContactDetails(contact.contactDetails || "")
    } else {
      setName("")
      setContactDetails("")
    }
  }, [contact, isOpen])

  if (!isOpen) return null

  const isEdit = !!contact

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return alert("Name is required")

    setLoading(true)
    try {
      if (isEdit && contact) {
        await updateContact(type, contact.id, { name, contactDetails })
        alert(`${type === "customer" ? "Customer" : "Supplier"} updated successfully!`)
      } else {
        await createContact(type, { name, contactDetails })
        alert(`${type === "customer" ? "Customer" : "Supplier"} added successfully!`)
      }
      onClose()
      router.refresh()
    } catch (err: any) {
      alert("Failed to save contact: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden text-left border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-lg text-slate-900">
            {isEdit ? "Edit" : "Add New"} {type === "customer" ? "Customer" : "Supplier"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              {type === "customer" ? "Customer Name" : "Supplier Name"}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 font-medium"
              placeholder={type === "customer" ? "e.g. Acme Corporation" : "e.g. D-Link Distributor"}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Contact / Address Details
            </label>
            <textarea
              value={contactDetails}
              onChange={e => setContactDetails(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-y"
              rows={4}
              placeholder="Address, phone numbers, contact persons, emails..."
            />
          </div>

          <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 inline-flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Save size={16} />
              {loading ? "Saving..." : "Save Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
