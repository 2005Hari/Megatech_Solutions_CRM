import { prisma } from "@/lib/prisma"
import SettingsClient from "./SettingsClient"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const [units, services] = await Promise.all([
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.service.findMany({ orderBy: { name: "asc" } }),
  ])

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Units of measure and the service catalogue used when building quotations.
        </p>
      </div>
      <SettingsClient units={units} services={services} />
    </div>
  )
}
