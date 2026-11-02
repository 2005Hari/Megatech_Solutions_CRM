"use client"

import { useState } from "react"
import { Upload } from "lucide-react"
import UploadCpoDialog from "@/components/cpo/UploadCpoDialog"

/** "Upload CPO" button for one specific quotation. */
export default function UploadCPOModal({
  quotationId,
  quotationRef,
  customerName,
}: {
  quotationId: string
  quotationRef: string
  customerName: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-foreground hover:text-accent font-bold text-[11px] uppercase tracking-wider inline-flex items-center gap-1 transition-colors"
      >
        <Upload size={14} /> Upload CPO
      </button>
      <UploadCpoDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        quotationId={quotationId}
        quotations={[{ id: quotationId, refNo: quotationRef, customerName }]}
      />
    </>
  )
}
