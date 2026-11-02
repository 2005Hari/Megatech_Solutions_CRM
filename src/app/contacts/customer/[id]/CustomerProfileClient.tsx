"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Edit, Trash2, Calendar, DollarSign, Percent, Clock, FileText, ShoppingBag, ArrowLeft, MapPin } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import ContactModal from "../../ContactModal"
import { deleteContact } from "@/app/actions/contacts"
import { useFeedback } from "@/components/ui/Feedback"

interface CustomerProfileClientProps {
  customer: {
    id: string
    name: string
    contactDetails: string | null
    createdAt: string
  }
  kpis: {
    lifetimeRevenue: number
    conversionRate: number
    activeOrdersCount: number
    totalQuotations: number
    wonQuotations: number
  }
  quotations: Array<{
    id: string
    refNo: string
    date: string
    validUntil: string | null
    status: string
    value: number
  }>
  cpos: Array<{
    id: string
    refNo: string
    date: string
    status: string
    revenue: number
  }>
}

export default function CustomerProfileClient({
  customer,
  kpis,
  quotations,
  cpos
}: CustomerProfileClientProps) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const handleEdit = () => {
    setIsModalOpen(true)
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete customer "${customer.name}"?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    })
    if (!ok) return

    const res = await deleteContact("customer", customer.id)
    if (!notify(res, "Customer deleted.")) return
    router.push("/contacts")
    router.refresh()
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
            <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
              Customer
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-500 mt-2 font-medium">
            <span className="flex items-center gap-1">
              <Calendar size={14} className="text-slate-400" />
              Added on {formatDate(new Date(customer.createdAt))}
            </span>
            {customer.contactDetails && (
              <span className="flex items-start gap-1">
                <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                <span className="whitespace-pre-line leading-normal">
                  {customer.contactDetails}
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
            <Trash2 size={16} /> Delete Customer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Lifetime Revenue
            </span>
            <span className="p-2 bg-green-50 text-green-600 rounded-lg">
              <DollarSign size={18} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatCurrency(kpis.lifetimeRevenue)}
          </div>
          <div className="text-slate-400 text-xs mt-1.5 font-medium">
            From fulfilled customer purchase orders
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Quotation Conversion
            </span>
            <span className="p-2 bg-red-50 text-red-600 rounded-lg">
              <Percent size={18} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis.conversionRate.toFixed(1)}%
          </div>
          <div className="text-slate-500 text-xs mt-1.5 font-semibold">
            {kpis.wonQuotations} Won / {kpis.totalQuotations} Total Quotations
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Active Orders
            </span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Clock size={18} />
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {kpis.activeOrdersCount}
          </div>
          <div className="text-slate-400 text-xs mt-1.5 font-medium">
            Open customer purchase orders
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Customer POs Section */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <ShoppingBag size={16} className="text-slate-400" />
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest">
              Customer Purchase Orders
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">PO No.</th>
                  <th className="px-6 py-3">PO Date</th>
                  <th className="px-6 py-3 text-right">Revenue</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cpos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-slate-500 font-medium">
                      No purchase orders raised yet
                    </td>
                  </tr>
                ) : (
                  cpos.map(cpo => (
                    <tr key={cpo.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono font-bold text-blue-600">
                        <Link href={`/cpo/${cpo.id}`} className="hover:underline">
                          {cpo.refNo}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {formatDate(new Date(cpo.date))}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">
                        {formatCurrency(cpo.revenue)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            cpo.status === "Fulfilled"
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : cpo.status === "Cancelled"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-blue-50 text-blue-700 border border-blue-200"
                          }`}
                        >
                          {cpo.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link
                          href={`/cpo/${cpo.id}`}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quotations Section */}
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
            <FileText size={16} className="text-slate-400" />
            <h3 className="font-bold text-xs text-slate-400 uppercase tracking-widest">
              Quotations History
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Quotation Ref.</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Valid Until</th>
                  <th className="px-6 py-3 text-right">Value</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-center text-slate-500 font-medium">
                      No quotations created yet
                    </td>
                  </tr>
                ) : (
                  quotations.map(q => (
                    <tr key={q.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 font-mono font-bold text-slate-900">
                        <Link href={`/quotations/${q.id}`} className="hover:text-red-600 hover:underline">
                          {q.refNo}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {formatDate(new Date(q.date))}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {q.validUntil ? formatDate(new Date(q.validUntil)) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-slate-900">
                        {formatCurrency(q.value)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            q.status === "Won"
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : q.status === "Lost"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {q.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Link
                          href={`/quotations/${q.id}`}
                          className="text-xs font-bold text-blue-600 hover:text-blue-800"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <ContactModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type="customer"
        contact={{
          id: customer.id,
          name: customer.name,
          contactDetails: customer.contactDetails
        }}
      />
    </div>
  )
}
