import Link from "next/link"
import { BarChart3, FileText, IndianRupee, PackageOpen, Plus, ShoppingCart, TrendingUp, Users } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { cpoFinance } from "@/lib/finance"
import { OPEN_QUOTATION_STATUSES } from "@/lib/status"
import { formatCurrency, formatDate } from "@/lib/utils"
import { round2 } from "@/lib/validation"
import { StatusBadge } from "@/components/ui/StatusBadge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table"

export const dynamic = "force-dynamic"

export default async function Dashboard() {
  // Only the columns the maths needs - not whole nested records.
  const [cpos, totalCustomers, openQuotes, openCPOs, activeSPOs, recentCPOs] = await Promise.all([
    prisma.customerPO.findMany({
      where: { status: { not: "Cancelled" } },
      select: {
        items: { select: { qty: true, sellPrice: true, estimatedCost: true } },
        supplierPOs: { select: { items: { select: { qty: true, buyPrice: true } } } },
      },
    }),
    prisma.customer.count(),
    prisma.quotation.count({ where: { status: { in: [...OPEN_QUOTATION_STATUSES] } } }),
    prisma.customerPO.count({ where: { status: "Open" } }),
    prisma.supplierPO.count({ where: { status: { notIn: ["Closed", "Draft"] } } }),
    prisma.customerPO.findMany({
      take: 5,
      orderBy: { date: "desc" },
      select: { id: true, refNo: true, status: true, date: true, customer: { select: { name: true } } },
    }),
  ])

  const finances = cpos.map(cpoFinance)
  const revenue = round2(finances.reduce((s, f) => s + f.revenue, 0))
  // Profit figures only count orders where the underlying costs are known,
  // otherwise missing costs would silently inflate profit.
  const withExpected = finances.filter(f => f.expectedProfit !== null)
  const withActual = finances.filter(f => f.actualProfit !== null)
  const expectedProfit = round2(withExpected.reduce((s, f) => s + (f.expectedProfit ?? 0), 0))
  const actualProfit = round2(withActual.reduce((s, f) => s + (f.actualProfit ?? 0), 0))

  const financialStats = [
    { name: "Order Revenue", value: formatCurrency(revenue), note: `${cpos.length} active orders`, icon: IndianRupee },
    {
      name: "Expected Profit",
      value: formatCurrency(expectedProfit),
      note: `${withExpected.length} of ${cpos.length} orders have cost estimates`,
      icon: TrendingUp,
    },
    {
      name: "Actual Profit",
      value: formatCurrency(actualProfit),
      note: `${withActual.length} of ${cpos.length} orders fully priced by suppliers`,
      icon: BarChart3,
    },
  ]

  const opStats = [
    { name: "Total Customers", value: totalCustomers, icon: Users },
    { name: "Open Quotations", value: openQuotes, icon: FileText },
    { name: "Open CPOs", value: openCPOs, icon: ShoppingCart },
    { name: "Active SPOs", value: activeSPOs, icon: PackageOpen },
  ]

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">Your business metrics for today.</p>
        </div>
        <Link
          href="/quotations/new"
          className="bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Quotation
        </Link>
      </div>

      <div>
        <h3 className="text-sm font-semibold tracking-tight text-foreground mb-4">Financials (Customer Orders)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {financialStats.map(item => (
            <div key={item.name} className="rounded-xl border border-card-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between pb-2">
                <p className="text-sm font-medium text-muted-foreground">{item.name}</p>
                <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</h3>
              <p className="text-xs text-muted-foreground mt-1">{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold tracking-tight text-foreground mb-4">Operations</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {opStats.map(item => (
            <div key={item.name} className="rounded-xl border border-card-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between pb-2">
                <p className="text-sm font-medium text-muted-foreground">{item.name}</p>
                <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</h3>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Recent Orders</h3>
          <Link href="/cpo" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            View all
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-card-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentCPOs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No recent activity.
                  </TableCell>
                </TableRow>
              ) : (
                recentCPOs.map(cpo => (
                  <TableRow key={cpo.id}>
                    <TableCell>
                      <Link href={`/cpo/${cpo.id}`} className="font-medium text-foreground hover:underline">
                        {cpo.refNo}
                      </Link>
                      <div className="text-xs text-muted-foreground">Customer PO</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{cpo.customer?.name || "Manual Entry"}</TableCell>
                    <TableCell>
                      <StatusBadge status={cpo.status} />
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatDate(cpo.date)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
