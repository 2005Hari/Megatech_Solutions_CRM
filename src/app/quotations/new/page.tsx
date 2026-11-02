import { prisma } from "@/lib/prisma"
import { PRODUCTS } from "@/lib/catalog"
import { previewQuotationRef } from "@/lib/refs"
import QuotationBuilder from "./QuotationBuilder"

export const dynamic = "force-dynamic"

export default async function NewQuotationPage() {
  const [services, units, customers, suggestedRefNo] = await Promise.all([
    prisma.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, defaultUnit: true, defaultRate: true },
    }),
    prisma.unit.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, contactDetails: true } }),
    previewQuotationRef(prisma),
  ])

  return (
    <div className="p-8">
      <QuotationBuilder
        products={PRODUCTS}
        services={services}
        units={units}
        customers={customers}
        suggestedRefNo={suggestedRefNo}
      />
    </div>
  )
}
