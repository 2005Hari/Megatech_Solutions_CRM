import { getCustomers } from "@/lib/actions/customers"
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
import { deleteCustomer } from "@/lib/actions/customers"

export default async function CustomersPage() {
  const customers = await getCustomers()

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your customer base.</p>
        </div>
        <Link href="/customers/new">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
        </Link>
      </div>

      <div className="rounded-xl border border-card-border bg-card shadow-sm overflow-hidden">
        {customers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center">
            <p>No customers found.</p>
            <Link href="/customers/new" className="mt-4">
              <Button variant="outline">Create your first customer</Button>
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
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell className="text-muted-foreground">{customer.contactDetails || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(customer.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <form action={async () => {
                      "use server"
                      await deleteCustomer(customer.id)
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
