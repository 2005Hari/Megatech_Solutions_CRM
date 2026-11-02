import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { formatCurrency, formatDate } from "@/lib/utils"
import { spoTotalCost } from "@/lib/finance"
import { PAGE_SIZE, pageWindow, parsePage } from "@/lib/pagination"
import { Button } from "@/components/ui/Button"
import { StatusBadge } from "@/components/ui/StatusBadge"
import Pagination from "@/components/ui/Pagination"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table"
import DeleteSPOButton from "./DeleteSPOButton"

export const dynamic = "force-dynamic"

export default async function SupplierPOsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams
  const total = await prisma.supplierPO.count()
  const { current, pages, skip, take } = pageWindow(parsePage(sp.page), total, PAGE_SIZE)

  const spos = await prisma.supplierPO.findMany({
    orderBy: { date: "desc" },
    skip,
    take,
    select: {
      id: true,
      refNo: true,
      date: true,
      status: true,
      cpoId: true,
      cpo: { select: { refNo: true } },
      supplier: { select: { name: true } },
      items: { select: { qty: true, buyPrice: true } },
    },
  })

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Supplier Purchase Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage POs issued to your suppliers.</p>
        </div>
      </div>

      <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
        {total === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
            <p>No supplier POs found.</p>
          </div>
        ) : (
          <>
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
                {spos.map(spo => (
                  <TableRow key={spo.id}>
                    <TableCell className="font-mono font-medium text-accent">
                      <Link href={`/spo/${spo.id}`}>{spo.refNo}</Link>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground text-xs">
                      {spo.cpo ? (
                        <Link href={`/cpo/${spo.cpoId}`} className="hover:text-foreground transition-colors hover:underline">
                          {spo.cpo.refNo}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {spo.supplier?.name || <span className="text-muted-foreground italic">Unassigned</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(spo.date)}</TableCell>
                    <TableCell className="text-right font-bold text-foreground">{formatCurrency(spoTotalCost(spo.items))}</TableCell>
                    <TableCell>
                      <StatusBadge status={spo.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/spo/${spo.id}`}>
                          <Button variant="ghost" size="sm" className="h-8">
                            View &amp; Manage
                          </Button>
                        </Link>
                        <DeleteSPOButton spoId={spo.id} refNo={spo.refNo} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination basePath="/spo" page={current} pages={pages} total={total} />
          </>
        )}
      </div>
    </div>
  )
}
