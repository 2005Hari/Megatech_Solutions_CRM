import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import CustomerProfileClient from "./CustomerProfileClient"

export const dynamic = "force-dynamic"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CustomerProfilePage({ params }: PageProps) {
  const { id } = await params

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      quotations: {
        include: { items: true },
        orderBy: { date: "desc" }
      },
      customerPOs: {
        include: { items: true },
        orderBy: { date: "desc" }
      }
    }
  })

  if (!customer) {
    notFound()
  }

  // Pre-calculate values on server
  const totalQuotations = customer.quotations.length
  const wonQuotations = customer.quotations.filter(q => q.status === "Won").length
  const conversionRate = totalQuotations > 0 ? (wonQuotations / totalQuotations) * 100 : 0

  const lifetimeRevenue = customer.customerPOs
    .filter(cpo => cpo.status === "Fulfilled")
    .reduce((sum, cpo) => sum + cpo.items.reduce((s, i) => s + (i.qty * i.sellPrice), 0), 0)

  const activeOrdersCount = customer.customerPOs.filter(cpo => cpo.status === "Open").length

  const kpis = {
    lifetimeRevenue,
    conversionRate,
    activeOrdersCount,
    totalQuotations,
    wonQuotations
  }

  // Clean data for passing to Client Component
  const formattedCustomer = {
    id: customer.id,
    name: customer.name,
    contactDetails: customer.contactDetails,
    createdAt: customer.createdAt.toISOString()
  }

  const formattedQuotations = customer.quotations.map(q => ({
    id: q.id,
    refNo: q.refNo,
    date: q.date.toISOString(),
    validUntil: q.validUntil ? q.validUntil.toISOString() : null,
    status: q.status,
    value: q.items.reduce((sum, item) => sum + (item.qty * item.sellPrice), 0)
  }))

  const formattedCpos = customer.customerPOs.map(cpo => ({
    id: cpo.id,
    refNo: cpo.refNo,
    date: cpo.date.toISOString(),
    status: cpo.status,
    revenue: cpo.items.reduce((sum, item) => sum + (item.qty * item.sellPrice), 0)
  }))

  return (
    <CustomerProfileClient
      customer={formattedCustomer}
      kpis={kpis}
      quotations={formattedQuotations}
      cpos={formattedCpos}
    />
  )
}
