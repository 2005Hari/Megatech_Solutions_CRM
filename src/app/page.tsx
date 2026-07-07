import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { 
  Users, 
  FileText, 
  ShoppingCart, 
  PackageOpen, 
  Plus,
  TrendingUp,
  BarChart3,
  IndianRupee
} from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table"

export default async function Dashboard() {
  const cpos = await prisma.customerPO.findMany({ 
    include: { items: true, supplierPOs: { include: { items: true } } } 
  });
  
  let totalRev = 0;
  let totalExpCost = 0;
  let totalActualCost = 0;
  
  cpos.forEach(cpo => {
    cpo.items.forEach(item => {
      totalRev += (item.qty * item.sellPrice);
      totalExpCost += (item.qty * (item.estimatedCost || 0));
    });
    if (cpo.supplierPOs.length > 0) {
      cpo.supplierPOs[0].items.forEach(item => {
        totalActualCost += (item.qty * (item.buyPrice || 0));
      });
    }
  });

  const expectedProfit = totalRev - totalExpCost;
  const actualProfit = totalRev - totalActualCost;

  const totalCustomers = await prisma.customer.count();
  const pendingQuotes = await prisma.quotation.count({ where: { status: "Pending" } });
  const openCPOs = await prisma.customerPO.count({ where: { status: "Open" } });
  const activeSPOs = await prisma.supplierPO.count({ where: { status: { notIn: ["Closed", "Draft"] } } });

  const financialStats = [
    {
      name: "Expected Revenue",
      value: formatCurrency(totalRev),
      icon: IndianRupee,
    },
    {
      name: "Expected Profit",
      value: formatCurrency(expectedProfit),
      icon: TrendingUp,
    },
    {
      name: "Actual Profit",
      value: formatCurrency(actualProfit),
      icon: BarChart3,
    },
  ];

  const opStats = [
    { name: "Total Customers", value: totalCustomers.toString(), icon: Users },
    { name: "Pending Quotes", value: pendingQuotes.toString(), icon: FileText },
    { name: "Open CPOs", value: openCPOs.toString(), icon: ShoppingCart },
    { name: "Active SPOs", value: activeSPOs.toString(), icon: PackageOpen },
  ];

  // Fetch recent activity dynamically
  const recentCPOs = await prisma.customerPO.findMany({ take: 3, orderBy: { date: 'desc' }, include: { customer: true } });
  const recentActivity = recentCPOs.map(cpo => ({
    id: cpo.id,
    type: "Customer PO",
    reference: cpo.refNo,
    status: cpo.status,
    date: cpo.date.toLocaleDateString(),
    user: cpo.customer?.name || "Manual Entry"
  }));

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">Your business metrics for today.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/quotations/new" className="bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Order
          </Link>
        </div>
      </div>

      {/* Financial Metrics */}
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-foreground mb-4">Financials (Won Orders)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {financialStats.map((item) => (
            <div key={item.name} className="rounded-xl border border-card-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between pb-2">
                <p className="text-sm font-medium text-muted-foreground">{item.name}</p>
                <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operational Stats Grid */}
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-foreground mb-4">Operations</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {opStats.map((item) => (
            <div key={item.name} className="rounded-xl border border-card-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between pb-2">
                <p className="text-sm font-medium text-muted-foreground">{item.name}</p>
                <item.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-semibold tracking-tight text-foreground">{item.value}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
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
                <TableHead>Client / Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivity.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No recent activity.</TableCell></TableRow>
              ) : recentActivity.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>
                    <div className="font-medium text-foreground">{activity.reference}</div>
                    <div className="text-xs text-muted-foreground">{activity.type}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{activity.user}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold border ${
                      activity.status === "Open" || activity.status === "Pending" ? "border-amber-500/20 bg-amber-500/10 text-amber-500" :
                      activity.status === "Won" || activity.status === "Sent" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" :
                      "border-card-border bg-muted/50 text-muted-foreground"
                    }`}>
                      {activity.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{activity.date}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
