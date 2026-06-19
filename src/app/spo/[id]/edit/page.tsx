import { prisma } from "@/lib/prisma"
import Link from "next/link"
import SPOEditForm from "./SPOEditForm"

export default async function SPOEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const spo = await prisma.supplierPO.findUnique({
    where: { id },
    include: {
      items: true,
      supplier: true,
      cpo: { include: { customer: true } }
    }
  })

  if (!spo) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl">
          Supplier PO not found or has been deleted.
        </div>
        <div className="mt-4">
          <Link href="/spo" className="text-sm text-blue-600 hover:underline">← Back to Supplier POs</Link>
        </div>
      </div>
    )
  }

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" }
  })

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href={`/spo/${spo.id}`} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
          ← Back to Supplier PO Details
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Supplier PO</h1>
          <p className="text-sm text-slate-500 mt-1">
            Modifying draft or reviewed details for <strong>{spo.refNo}</strong>
          </p>
        </div>
      </div>

      <SPOEditForm spo={spo} suppliers={suppliers} />
    </div>
  )
}
