"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Search, Edit2, Trash2, User, Building2, MapPin } from "lucide-react"
import ContactModal from "./ContactModal"
import { deleteContact } from "@/app/actions/contacts"
import { useFeedback } from "@/components/ui/Feedback"

interface ContactsClientProps {
  customers: Array<{
    id: string
    name: string
    contactDetails: string | null
    createdAt: Date
    _count: {
      customerPOs: number
      quotations: number
    }
  }>
  suppliers: Array<{
    id: string
    name: string
    contactDetails: string | null
    createdAt: Date
    _count: {
      supplierPOs: number
    }
  }>
}

export default function ContactsClient({ customers, suppliers }: ContactsClientProps) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()
  const [activeTab, setActiveTab] = useState<"customers" | "suppliers">("customers")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  // Bumped on every open so the modal remounts with fresh form state.
  const [modalKey, setModalKey] = useState(0)
  const [modalType, setModalType] = useState<"customer" | "supplier">("customer")
  const [selectedContact, setSelectedContact] = useState<{
    id: string
    name: string
    contactDetails: string | null
  } | null>(null)

  const handleOpenAddModal = (type: "customer" | "supplier") => {
    setModalType(type)
    setSelectedContact(null)
    setModalKey(k => k + 1)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (
    type: "customer" | "supplier",
    contact: { id: string; name: string; contactDetails: string | null }
  ) => {
    setModalType(type)
    setSelectedContact(contact)
    setModalKey(k => k + 1)
    setIsModalOpen(true)
  }

  const handleDelete = async (type: "customer" | "supplier", id: string, name: string) => {
    const ok = await confirm({
      title: `Delete "${name}"?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    })
    if (!ok) return

    const res = await deleteContact(type, id)
    if (notify(res, `${type === "customer" ? "Customer" : "Supplier"} deleted.`)) router.refresh()
  }

  // Filters
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.contactDetails || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.contactDetails || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts Directory</h1>
          <p className="text-slate-500 text-sm mt-1">Manage customers and suppliers database.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          {activeTab === "customers" ? (
            <button
              onClick={() => handleOpenAddModal("customer")}
              className="w-full md:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-red-600/10 transition-colors cursor-pointer"
            >
              <Plus size={16} /> Add Customer
            </button>
          ) : (
            <button
              onClick={() => handleOpenAddModal("supplier")}
              className="w-full md:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Plus size={16} /> Add Supplier
            </button>
          )}
        </div>
      </div>

      {/* Search & Tabs control bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white border border-slate-200/80 rounded-xl p-4 mb-6 shadow-xs">
        {/* Tabs */}
        <div className="flex p-1 bg-slate-100 rounded-lg max-w-xs w-full sm:w-auto">
          <button
            onClick={() => {
              setActiveTab("customers")
              setSearchQuery("")
            }}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "customers"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <User size={14} /> Customers ({customers.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("suppliers")
              setSearchQuery("")
            }}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "suppliers"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            <Building2 size={14} /> Suppliers ({suppliers.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-xs">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium"
          />
        </div>
      </div>

      {/* List content */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        {activeTab === "customers" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Customer Name</th>
                  <th className="px-6 py-3">Contact Details / Address</th>
                  <th className="px-6 py-3 text-center">Quotations</th>
                  <th className="px-6 py-3 text-center">Purchase Orders</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">
                      No customers found
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map(customer => (
                    <tr key={customer.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <Link
                          href={`/contacts/customer/${customer.id}`}
                          className="font-bold text-slate-900 hover:text-red-600 block transition-colors"
                        >
                          {customer.name}
                        </Link>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5 block">
                          ID: {customer.id.substring(0, 8)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs md:max-w-md truncate">
                        <div className="flex items-start gap-1">
                          <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                          <span className="whitespace-pre-line text-xs font-medium">
                            {customer.contactDetails || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800">
                        {customer._count.quotations}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800">
                        {customer._count.customerPOs}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <Link
                            href={`/contacts/customer/${customer.id}`}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                          >
                            View Profile
                          </Link>
                          <button
                            onClick={() => handleOpenEditModal("customer", customer)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete("customer", customer.id, customer.name)}
                            className="text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3">Supplier Name</th>
                  <th className="px-6 py-3">Contact Details / Address</th>
                  <th className="px-6 py-3 text-center">Purchase Orders</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 font-medium">
                      No suppliers found
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map(supplier => (
                    <tr key={supplier.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <Link
                          href={`/contacts/supplier/${supplier.id}`}
                          className="font-bold text-slate-900 hover:text-slate-700 block transition-colors"
                        >
                          {supplier.name}
                        </Link>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase mt-0.5 block">
                          ID: {supplier.id.substring(0, 8)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs md:max-w-md truncate">
                        <div className="flex items-start gap-1">
                          <MapPin size={14} className="text-slate-400 mt-0.5 shrink-0" />
                          <span className="whitespace-pre-line text-xs font-medium">
                            {supplier.contactDetails || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-800">
                        {supplier._count.supplierPOs}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-3">
                          <Link
                            href={`/contacts/supplier/${supplier.id}`}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                          >
                            View Profile
                          </Link>
                          <button
                            onClick={() => handleOpenEditModal("supplier", supplier)}
                            className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete("supplier", supplier.id, supplier.name)}
                            className="text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <ContactModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type={modalType}
        contact={selectedContact}
      />
    </div>
  )
}
