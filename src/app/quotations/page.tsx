import Link from "next/link"
import { Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { formatCurrency, formatDate } from "@/lib/utils"
import { lineTotal } from "@/lib/totals"
import { round2 } from "@/lib/validation"
import { CONVERTIBLE_QUOTATION_STATUSES } from "@/lib/status"
import { PAGE_SIZE, pageWindow, parsePage } from "@/lib/pagination"
import { Button } from "@/components/ui/Button"
import { StatusBadge } from "@/components/ui/StatusBadge"
import Pagination from "@/components/ui/Pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table"
import UploadCPOModal from "./upload-cpo"
import DeleteQuotationButton from "./DeleteQuotationButton"

export const dynamic = "force-dynamic"

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams
  const total = await prisma.quotation.count()
  const { current, pages, skip, take } = pageWindow(parsePage(sp.page), total, PAGE_SIZE)

  const quotations = await prisma.quotation.findMany({
    orderBy: { date: "desc" },
    skip,
    take,
    select: {
      id: true,
      refNo: true,
      date: true,
      validUntil: true,
      status: true,
      customer: { select: { name: true } },
      items: { select: { qty: true, sellPrice: true } }, // includes items inside sections
    },
  })

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
        {total === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
            <p>No quotations found.</p>
            <Link href="/quotations/new" className="mt-4">
              <Button variant="outline">Create your first quotation</Button>
            </Link>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ref No.</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead className="text-right">Value (ex. tax)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations.map(q => {
                  const value = round2(q.items.reduce((s, i) => s + lineTotal(i.qty, i.sellPrice), 0))
                  const customerName = q.customer?.name || "Manual Entry"
                  return (
                    <TableRow key={q.id}>
                      <TableCell className="font-mono font-medium">
                        <Link href={`/quotations/${q.id}`} className="hover:underline">
                          {q.refNo}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">{customerName}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(q.date)}</TableCell>
                      <TableCell className="text-muted-foreground">{q.validUntil ? formatDate(q.validUntil) : "—"}</TableCell>
                      <TableCell className="text-right font-bold text-foreground">{formatCurrency(value)}</TableCell>
                      <TableCell>
                        <StatusBadge status={q.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/quotations/${q.id}`}>
                            <Button variant="ghost" size="sm" className="h-8">
                              View
                            </Button>
                          </Link>
                          {CONVERTIBLE_QUOTATION_STATUSES.includes(q.status) && (
                            <UploadCPOModal quotationId={q.id} quotationRef={q.refNo} customerName={customerName} />
                          )}
                          <DeleteQuotationButton quotationId={q.id} refNo={q.refNo} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <Pagination basePath="/quotations" page={current} pages={pages} total={total} />
          </>
        )}
      </div>
    </div>
  )
}
