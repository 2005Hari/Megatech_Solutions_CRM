import Link from "next/link"
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
import UploadCPOFromQuotationsModal from "./upload-cpo-modal"
import DeleteCPOButton from "./DeleteCPOButton"

export const dynamic = "force-dynamic"

export default async function CustomerPOsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams
  const total = await prisma.customerPO.count()
  const { current, pages, skip, take } = pageWindow(parsePage(sp.page), total, PAGE_SIZE)

  const [cpos, convertible] = await Promise.all([
    prisma.customerPO.findMany({
      orderBy: { date: "desc" },
      skip,
      take,
      select: {
        id: true,
        refNo: true,
        date: true,
        status: true,
        customer: { select: { name: true } },
        items: { select: { qty: true, sellPrice: true } },
        supplierPOs: { select: { id: true, refNo: true } },
      },
    }),
    prisma.quotation.findMany({
      where: { status: { in: [...CONVERTIBLE_QUOTATION_STATUSES] } },
      orderBy: { date: "desc" },
      take: 200,
      select: { id: true, refNo: true, customer: { select: { name: true } } },
    }),
  ])

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Customer Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage POs received from your customers.</p>
        </div>
        <UploadCPOFromQuotationsModal
          quotations={convertible.map(q => ({ id: q.id, refNo: q.refNo, customerName: q.customer?.name || "Manual Entry" }))}
        />
      </div>

      <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
        {total === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
            <p>No customer POs found.</p>
          </div>
        ) : (
          <>
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
                  const revenue = round2(cpo.items.reduce((s, i) => s + lineTotal(i.qty, i.sellPrice), 0))
                  return (
                    <TableRow key={cpo.id}>
                      <TableCell className="font-mono font-medium text-accent">
                        <Link href={`/cpo/${cpo.id}`}>{cpo.refNo}</Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{cpo.customer?.name || "Manual Entry"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(cpo.date)}</TableCell>
                      <TableCell className="text-right font-bold text-foreground">{formatCurrency(revenue)}</TableCell>
                      <TableCell>
                        {cpo.supplierPOs.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {cpo.supplierPOs.map(spo => (
                              <Link
                                key={spo.id}
                                href={`/spo/${spo.id}`}
                                className="px-2 py-1 bg-muted text-foreground rounded-md text-xs font-mono border border-card-border hover:bg-muted/50 transition-colors"
                              >
                                {spo.refNo}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <span className="text-rose-500 text-[10px] uppercase tracking-wider font-bold bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-md">
                            Not Raised
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={cpo.status} />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link href={`/cpo/${cpo.id}`}>
                            <Button variant="ghost" size="sm" className="h-8">
                              View Details
                            </Button>
                          </Link>
                          <DeleteCPOButton cpoId={cpo.id} refNo={cpo.refNo} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <Pagination basePath="/cpo" page={current} pages={pages} total={total} />
          </>
        )}
      </div>
    </div>
  )
}
