import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import SupplierProfileClient from "./SupplierProfileClient"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SupplierProfilePage({ params }: PageProps) {
  const { id } = await params

  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      supplierPOs: {
        include: {
          items: true,
          cpo: true
        },
        orderBy: { date: "desc" }
      }
    }
  })

  if (!supplier) {
    notFound()
  }

  // Pre-calculate values on server
  const totalPOs = supplier.supplierPOs.length

  const lifetimeSpend = supplier.supplierPOs
    .filter(spo => ["Fully Received", "Closed"].includes(spo.status))
    .reduce((sum, spo) => sum + spo.items.reduce((s, i) => s + (i.qty * (i.buyPrice || 0)), 0), 0)

  const activePOsCount = supplier.supplierPOs.filter(spo =>
    ["Sent", "Partially Received"].includes(spo.status)
  ).length

  const kpis = {
    lifetimeSpend,
    activePOsCount,
    totalPOs
  }

  // Clean data for passing to Client Component
  const formattedSupplier = {
    id: supplier.id,
    name: supplier.name,
    contactDetails: supplier.contactDetails,
    createdAt: supplier.createdAt.toISOString()
  }

  const formattedSpos = supplier.supplierPOs.map(spo => ({
    id: spo.id,
    refNo: spo.refNo,
    date: spo.date.toISOString(),
    status: spo.status,
    cost: spo.items.reduce((sum, item) => sum + (item.qty * (item.buyPrice || 0)), 0),
    cpoRef: spo.cpo ? spo.cpo.refNo : null,
    cpoId: spo.cpoId
  }))

  return (
    <SupplierProfileClient
      supplier={formattedSupplier}
      kpis={kpis}
      spos={formattedSpos}
    />
  )
}
