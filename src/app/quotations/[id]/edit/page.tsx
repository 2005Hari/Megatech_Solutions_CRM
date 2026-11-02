import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import type { ProductOption } from "@/lib/catalog"
import { EDITABLE_QUOTATION_STATUSES } from "@/lib/status"
import QuotationBuilder from "../../new/QuotationBuilder"

export const dynamic = "force-dynamic"

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      sections: { include: { items: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
      items: { where: { sectionId: null }, orderBy: { order: "asc" } },
      customer: true,
    },
  })
  if (!quotation) notFound()

  // Lock policy: only open quotations can be edited. Anything else gets a revision.
  if (!EDITABLE_QUOTATION_STATUSES.includes(quotation.status)) {
    redirect(`/quotations/${quotation.id}`)
  }

  const [dbProducts, services, units, customers] = await Promise.all([
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
  ])
  const products: ProductOption[] = dbProducts.map(p => ({ brand: p.brand ?? "", desc: p.name, rate: p.defaultRate }))

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href={`/quotations/${quotation.id}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Quotation Details
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Quotation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Updating details for quotation <strong>{quotation.refNo}</strong>
          </p>
        </div>
      </div>

      <QuotationBuilder
        products={products}
        services={services}
        units={units}
        customers={customers}
        initialQuotation={quotation}
      />
    </div>
  )
}
