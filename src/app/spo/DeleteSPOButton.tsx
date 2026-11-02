"use client"

import { deleteSPO } from "@/app/actions/spo"
import DeleteRecordButton from "@/components/ui/DeleteRecordButton"

type Props = { spoId: string; refNo: string; redirectTo?: string; className?: string; showText?: boolean }

export default function DeleteSPOButton({ spoId, refNo, ...rest }: Props) {
  return <DeleteRecordButton noun="supplier PO" refNo={refNo} onDelete={() => deleteSPO(spoId)} {...rest} />
}
