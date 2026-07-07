import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import UploadCPOModal from "./upload-cpo";
import DeleteQuotationButton from "./DeleteQuotationButton";
import { Button } from "@/components/ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table"
import { Plus } from "lucide-react";

export default async function QuotationsPage() {
  const quotations = await prisma.quotation.findMany({
    include: { items: true, customer: true },
    orderBy: { date: 'desc' }
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Quotations</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your customer quotations.</p>
        </div>
        <Link href="/quotations/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Quotation
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
        {quotations.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
            <p>No quotations found.</p>
            <Link href="/quotations/new" className="mt-4">
              <Button variant="outline">Create your first quotation</Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ref No.</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map(q => {
                const total = q.items.reduce((s, i) => s + (i.qty * i.sellPrice), 0);
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono font-medium">{q.refNo}</TableCell>
                    <TableCell className="font-medium">{q.customer?.name || "Manual Entry"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(q.date)}</TableCell>
                    <TableCell className="text-muted-foreground">{q.validUntil ? formatDate(q.validUntil) : '—'}</TableCell>
                    <TableCell className="text-right font-bold text-foreground">{formatCurrency(total)}</TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                        q.status === 'Won' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                        q.status === 'Lost' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 
                        'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      }`}>
                        {q.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/quotations/${q.id}`}>
                          <Button variant="ghost" size="sm" className="h-8">View</Button>
                        </Link>
                        {(q.status === 'Pending' || q.status === 'Won') && (
                          <UploadCPOModal quotationId={q.id} quotationRef={q.refNo} customerName={q.customer?.name || "Manual Entry"} />
                        )}
                        <DeleteQuotationButton quotationId={q.id} refNo={q.refNo} />
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
