import { getSuppliers } from "@/lib/actions/suppliers"
import { Button } from "@/components/ui/Button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table"
import Link from "next/link"
import { Plus, Trash2 } from "lucide-react"
import { deleteSupplier } from "@/lib/actions/suppliers"

export default async function SuppliersPage() {
  const suppliers = await getSuppliers()

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Suppliers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your vendors and suppliers.</p>
        </div>
        <Link href="/suppliers/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Supplier
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
        {suppliers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
            <p>No suppliers found.</p>
            <Link href="/suppliers/new" className="mt-4">
              <Button variant="outline">Create your first supplier</Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact Details</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-muted-foreground">{supplier.contactDetails || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(supplier.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <form action={async () => {
                      "use server"
                      await deleteSupplier(supplier.id)
                    }}>
                      <Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
