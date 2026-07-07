import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import UploadCPOFromQuotationsModal from "./upload-cpo-modal";
import DeleteCPOButton from "./DeleteCPOButton";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table"

export default async function CustomerPOsPage() {
  const cpos = await prisma.customerPO.findMany({
    include: { items: true, customer: true, supplierPOs: true },
    orderBy: { date: 'desc' }
  });

  const pendingQuotations = await prisma.quotation.findMany({
    where: { status: "Pending" },
    include: { customer: true },
    orderBy: { date: 'desc' }
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Customer Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage POs received from your customers.</p>
        </div>
        <UploadCPOFromQuotationsModal pendingQuotations={pendingQuotations} />
      </div>

      <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
        {cpos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
            <p>No customer POs found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>PO Date</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead>Supplier PO</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cpos.map(cpo => {
                const total = cpo.items.reduce((s, i) => s + (i.qty * i.sellPrice), 0);
                const spo = cpo.supplierPOs[0];
                
                return (
                  <TableRow key={cpo.id}>
                    <TableCell className="font-mono font-medium text-accent">
                      <Link href={`/cpo/${cpo.id}`}>{cpo.refNo}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{cpo.customer?.name || "Manual Entry"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(cpo.date)}</TableCell>
                    <TableCell className="text-right font-bold text-foreground">{formatCurrency(total)}</TableCell>
                    <TableCell>
                      {spo ? (
                        <Link href={`/spo/${spo.id}`} className="px-2 py-1 bg-muted text-foreground rounded-md text-xs font-mono border border-card-border hover:bg-muted/50 transition-colors">
                          {spo.refNo}
                        </Link>
                      ) : (
                        <span className="text-rose-500 text-[10px] uppercase tracking-wider font-bold bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-md">Not Raised</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                        cpo.status === 'Fulfilled' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                        cpo.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 
                        'bg-accent/10 text-accent border border-accent/20'
                      }`}>
                        {cpo.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/cpo/${cpo.id}`}>
                          <Button variant="ghost" size="sm" className="h-8">View Details</Button>
                        </Link>
                        <DeleteCPOButton cpoId={cpo.id} refNo={cpo.refNo} />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
