import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { EDITABLE_SPO_STATUSES } from "@/lib/status"
import SPOEditForm from "./SPOEditForm"

export const dynamic = "force-dynamic"

export default async function SPOEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const spo = await prisma.supplierPO.findUnique({
    where: { id },
    include: { items: true, cpo: { include: { customer: true } } },
  })
  if (!spo) notFound()

  // Once a PO has gone to the supplier its content is frozen.
  if (!EDITABLE_SPO_STATUSES.includes(spo.status)) redirect(`/spo/${spo.id}`)

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, contactDetails: true },
  })

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href={`/spo/${spo.id}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Supplier PO Details
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Supplier PO</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Modifying draft or reviewed details for <strong>{spo.refNo}</strong>
          </p>
        </div>
      </div>

      <SPOEditForm spo={spo} suppliers={suppliers} />
    </div>
  )
}
