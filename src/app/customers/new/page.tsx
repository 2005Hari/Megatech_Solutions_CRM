import { createCustomer } from "@/lib/actions/customers"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function NewCustomerPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">New Customer</h1>
          <p className="text-sm text-muted-foreground mt-1">Add a new customer to your database.</p>
        </div>
      </div>

      <div className="rounded-xl border border-card-border bg-card p-6 shadow-sm">
        <form action={createCustomer as any} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
              Customer Name <span className="text-rose-500">*</span>
            </label>
            <Input id="name" name="name" placeholder="e.g. Acme Corp" required />
          </div>

          <div className="space-y-2">
            <label htmlFor="contactDetails" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
              Contact Details
            </label>
            <Input id="contactDetails" name="contactDetails" placeholder="Email, Phone, or Address" />
            <p className="text-[0.8rem] text-muted-foreground">Optional contact information for this customer.</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-card-border">
            <Link href="/customers">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit">Save Customer</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
