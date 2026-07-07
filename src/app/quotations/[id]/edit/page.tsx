import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import QuotationBuilder from "../../new/QuotationBuilder"

export default async function EditQuotationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: true,
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

  // Lock Policy: Redirect if not Pending
  if (quotation.status !== "Pending") {
    redirect(`/quotations/${quotation.id}`)
  }

  // We hardcode products list just like in new/page.tsx
  const PRODUCTS = [
    { brand: 'CP Plus', desc: '2MP Dome Camera (CP-UNC-DA21L3)', rate: 1200 },
    { brand: 'CP Plus', desc: '4 Channel NVR (CP-UNR-4K411-V2)', rate: 3500 },
    { brand: 'Hikvision', desc: '2MP Bullet Camera (DS-2CE16D0T-IRP)', rate: 1100 },
    { brand: 'Hikvision', desc: '8 Channel DVR (DS-7208HGHI-F1)', rate: 4200 },
    { brand: 'Dell', desc: 'OptiPlex 3090 Tower Desktop (Core i5, 8GB, 1TB)', rate: 45000 },
    { brand: 'Dell', desc: '24" Monitor (E2422H)', rate: 11000 },
    { brand: 'HP', desc: 'ProDesk 400 G7 Microtower (Core i3, 8GB, 512GB SSD)', rate: 38000 },
    { brand: 'D-Link', desc: '8-Port Gigabit Switch (DGS-1008A)', rate: 1500 },
    { brand: 'D-Link', desc: 'Cat6 UTP Cable Roll (305m)', rate: 2500 },
    { brand: 'TP-Link', desc: 'Archer C6 Gigabit Router', rate: 2200 },
    { brand: 'TP-Link', desc: '16-Port Switch (TL-SG1016D)', rate: 3500 }
  ]

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href={`/quotations/${quotation.id}`} className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
          ← Back to Quotation Details
        </Link>
      </div>

      <div className="flex justify-between items-start mb-6 max-w-5xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Edit Quotation</h1>
          <p className="text-sm text-slate-500 mt-1">
            Updating details for quotation <strong>{quotation.refNo}</strong>
          </p>
        </div>
      </div>

      <QuotationBuilder 
        products={PRODUCTS} 
        initialQuotation={quotation} 
      />
    </div>
  )
}
