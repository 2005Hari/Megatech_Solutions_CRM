"use client"

import { deleteQuotation } from "@/app/actions/quotations"
import DeleteRecordButton from "@/components/ui/DeleteRecordButton"

type Props = { quotationId: string; refNo: string; redirectTo?: string; className?: string; showText?: boolean }

export default function DeleteQuotationButton({ quotationId, refNo, ...rest }: Props) {
  return <DeleteRecordButton noun="quotation" refNo={refNo} onDelete={() => deleteQuotation(quotationId)} {...rest} />
}
