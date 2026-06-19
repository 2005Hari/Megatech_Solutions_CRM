"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Edit, Trash2, Calendar, DollarSign, Clock, Factory, ArrowLeft, MapPin } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import ContactModal from "../../ContactModal"
import { deleteContact } from "@/app/actions/contacts"

interface SupplierProfileClientProps {
  supplier: {
    id: string
    name: string
    contactDetails: string | null
    createdAt: string
  }
  kpis: {
    lifetimeSpend: number
    activePOsCount: number
    totalPOs: number
  }
  spos: Array<{
    id: string
    refNo: string
    date: string
    status: string
    cost: number
    cpoRef: string | null
    cpoId: string | null
  }>
}

export default function SupplierProfileClient({
  supplier,
  kpis,
  spos
}: SupplierProfileClientProps) {
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const handleEdit = () => {
    setIsModalOpen(true)
  }

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete supplier "${supplier.name}"?`)) {
      return
    }

    try {
      await deleteContact("supplier", supplier.id)
      alert("Supplier deleted successfully.")
      router.push("/contacts")
      router.refresh()
    } catch (error: any) {
      alert(error.message || "Failed to delete supplier.")
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/contacts"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Contacts
        </Link>
      </div>

      {/* Header Block */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-6 mb-8 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{supplier.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-950 text-slate-50 border border-slate-900">
              Supplier
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-500 mt-2 font-medium">
            <span className="flex items-center gap-1">
              <Calendar size={14} className="text-slate-400" />
              Added on {formatDate(new Date(supplier.createdAt))}
            </span>
            {supplier.contactDetails && (
              <span className="flex items-start gap-1">
                <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <span className="whitespace-pre-line leading-normal">
                  {supplier.contactDetails}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={handleEdit}
            className="flex-1 md:flex-none px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit size={16} /> Edit Details
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 md:flex-none px-4 py-2 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 size={16} /> Delete Supplier
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Lifetime Spend
            </span>
            <span className="p-2 bg-red-50 text-red-600 rounded-lg">
              <DollarSign size={18} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(kpis.lifetimeSpend)}
          </div>
          <div className="text-slate-400 text-xs mt-1.5 font-medium">
            From Fully Received and Closed supplier purchase orders
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Active POs
            </span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Clock size={18} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis.activePOsCount}
          </div>
          <div className="text-slate-400 text-xs mt-1.5 font-medium">
            SPOs currently in Sent or Partially Received status
          </div>
        </div>
      </div>

      {/* Supplier POs Section */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Factory size={16} className="text-slate-400" />
          <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest">
            Supplier Purchase Orders
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">SPO Ref.</th>
                <th className="px-6 py-3">Linked CPO</th>
                <th className="px-6 py-3">PO Date</th>
                <th className="px-6 py-3 text-right">Cost</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {spos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-slate-500 font-medium">
                    No supplier POs created yet
                  </td>
                </tr>
              ) : (
                spos.map(spo => (
                  <tr key={spo.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-mono font-bold text-blue-600">
                      <Link href={`/spo/${spo.id}`} className="hover:underline">
                        {spo.refNo}
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-500 text-xs font-semibold">
                      {spo.cpoId ? (
                        <Link href={`/cpo/${spo.cpoId}`} className="hover:text-blue-600 hover:underline">
                          {spo.cpoRef}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 font-medium">
                      {formatDate(new Date(spo.date))}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-slate-900">
                      {formatCurrency(spo.cost)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                          spo.status === "Draft"
                            ? "bg-slate-100 text-slate-700 border border-slate-200"
                            : spo.status === "Ready For Review"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : spo.status === "Sent"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : spo.status === "Fully Received"
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : "bg-slate-950 text-slate-50"
                        }`}
                      >
                        {spo.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Link
                        href={`/spo/${spo.id}`}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800"
                      >
                        Manage PO
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <ContactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type="supplier"
        contact={{
          id: supplier.id,
          name: supplier.name,
          contactDetails: supplier.contactDetails
        }}
      />
    </div>
  )
}
