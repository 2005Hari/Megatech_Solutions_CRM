import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table"

export default async function SupplierPOsPage() {
  const spos = await prisma.supplierPO.findMany({
    include: { items: true, supplier: true, cpo: { include: { customer: true } } },
    orderBy: { date: 'desc' }
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Supplier Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage POs issued to your suppliers.</p>
        </div>
      </div>

      <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
        {spos.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
            <p>No supplier POs found.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SPO Ref</TableHead>
                <TableHead>Linked CPO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spos.map(spo => {
                const total = spo.items.reduce((s, i) => s + (i.qty * (i.buyPrice || 0)), 0);
                
                return (
                  <TableRow key={spo.id}>
                    <TableCell className="font-mono font-medium text-accent">
                      <Link href={`/spo/${spo.id}`}>{spo.refNo}</Link>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {spo.cpo ? <Link href={`/cpo/${spo.cpoId}`} className="hover:text-foreground transition-colors hover:underline">{spo.cpo.refNo}</Link> : '—'}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{spo.supplier?.name || <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(spo.date)}</TableCell>
                    <TableCell className="text-right font-bold text-foreground">{formatCurrency(total)}</TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                        spo.status === 'Draft' ? 'bg-muted/50 text-muted-foreground border border-card-border' :
                        spo.status === 'Ready For Review' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        spo.status === 'Sent' ? 'bg-accent/10 text-accent border border-accent/20' : 
                        spo.status === 'Fully Received' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                        'bg-accent text-accent-foreground'
                      }`}>
                        {spo.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Link href={`/spo/${spo.id}`}>
                        <Button variant="ghost" size="sm" className="h-8">View & Manage</Button>
                      </Link>
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
