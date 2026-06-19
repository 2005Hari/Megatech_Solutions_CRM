import { prisma } from "@/lib/prisma"
import ContactsClient from "./ContactsClient"

// Disable caching for this route so data updates are reflected instantly
export const dynamic = "force-dynamic"

export default async function ContactsPage() {
  const [customers, suppliers] = await Promise.all([
    prisma.customer.findMany({
      include: {
        _count: {
          select: {
            customerPOs: true,
            quotations: true
          }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.supplier.findMany({
      include: {
        _count: {
          select: {
            supplierPOs: true
          }
        }
      },
      orderBy: { name: "asc" }
    })
  ])

  return <ContactsClient customers={customers} suppliers={suppliers} />
}
