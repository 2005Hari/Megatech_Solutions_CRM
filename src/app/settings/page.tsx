import { prisma } from "@/lib/prisma"
import SettingsClient from "./SettingsClient"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const [units, services, products, whatsAppSenders] = await Promise.all([
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.service.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.whatsAppSender.findMany({ orderBy: { label: "asc" } }),
  ])

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Units, the product and service catalogue, and the WhatsApp requirement-to-quotation bot.
        </p>
      </div>
      <SettingsClient units={units} services={services} products={products} whatsAppSenders={whatsAppSenders} />
    </div>
  )
}
