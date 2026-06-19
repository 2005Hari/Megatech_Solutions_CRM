import { createSupplier } from "@/lib/actions/suppliers"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function NewSupplierPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/suppliers" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">New Supplier</h1>
          <p className="text-sm text-muted-foreground mt-1">Add a new vendor to your database.</p>
        </div>
      </div>

      <div className="rounded-xl border border-card-border bg-card p-6 shadow-sm">
        <form action={createSupplier as any} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
              Supplier Name <span className="text-rose-500">*</span>
            </label>
            <Input id="name" name="name" placeholder="e.g. Global Tech Supplies" required />
          </div>

          <div className="space-y-2">
            <label htmlFor="contactDetails" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground">
              Contact Details
            </label>
            <Input id="contactDetails" name="contactDetails" placeholder="Email, Phone, or Address" />
            <p className="text-[0.8rem] text-muted-foreground">Optional contact information for this supplier.</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-card-border">
            <Link href="/suppliers">
              <Button type="button" variant="ghost">Cancel</Button>
            </Link>
            <Button type="submit">Save Supplier</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
