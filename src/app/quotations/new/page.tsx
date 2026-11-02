import { prisma } from "@/lib/prisma"
import type { ProductOption } from "@/lib/catalog"
import { previewQuotationRef } from "@/lib/refs"
import QuotationBuilder from "./QuotationBuilder"

export const dynamic = "force-dynamic"

export default async function NewQuotationPage() {
  const [dbProducts, services, units, customers, suggestedRefNo] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { brand: true, name: true, defaultRate: true },
    }),
    prisma.service.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, description: true, defaultUnit: true, defaultRate: true },
    }),
    prisma.unit.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.customer.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, contactDetails: true } }),
    previewQuotationRef(prisma),
  ])
  const products: ProductOption[] = dbProducts.map(p => ({ brand: p.brand ?? "", desc: p.name, rate: p.defaultRate }))

  return (
    <div className="p-8">
      <QuotationBuilder
        products={products}
        services={services}
        units={units}
        customers={customers}
        suggestedRefNo={suggestedRefNo}
      />
    </div>
  )
}
