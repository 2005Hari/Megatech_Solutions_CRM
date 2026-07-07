import { prisma } from "@/lib/prisma"
import Link from "next/link"
import QuotationDetailsClient from "./QuotationDetailsClient"

export default async function QuotationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      sections: {
        include: {
          items: {
            orderBy: { order: 'asc' }
          }
        },
        orderBy: { order: 'asc' }
      },
      items: {
        where: { sectionId: null },
        orderBy: { order: 'asc' }
      },
      customer: true
    }
  })

  if (!quotation) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl">
          Quotation not found.
        </div>
        <div className="mt-4">
          <Link href="/quotations" className="text-sm text-blue-600 hover:underline">← Back to Quotations</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="mb-2">
        <Link href="/quotations" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
          ← Back to Quotations
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Quotation Summary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reference code <strong className="text-foreground">{quotation.refNo}</strong> for <strong className="text-foreground">{quotation.customer?.name || "Manual Entry"}</strong>
          </p>
        </div>
      </div>

      <QuotationDetailsClient quotation={quotation} />
    </div>
  )
}
