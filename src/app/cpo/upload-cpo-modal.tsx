"use client"

import { useState } from "react"
import { Upload } from "lucide-react"
import UploadCpoDialog, { type ConvertibleQuotation } from "@/components/cpo/UploadCpoDialog"

/** "Upload Customer PO" button on the CPO list: pick any convertible quotation. */
export default function UploadCPOFromQuotationsModal({ quotations }: { quotations: ConvertibleQuotation[] }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2 rounded-lg font-medium text-sm transition-colors inline-flex items-center gap-2"
      >
        <Upload size={16} /> Upload Customer PO
      </button>
      <UploadCpoDialog open={isOpen} onClose={() => setIsOpen(false)} quotations={quotations} />
    </>
  )
}
