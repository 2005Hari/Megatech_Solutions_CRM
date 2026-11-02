"use client"

import { deleteCPO } from "@/app/actions/cpo"
import DeleteRecordButton from "@/components/ui/DeleteRecordButton"

type Props = { cpoId: string; refNo: string; redirectTo?: string; className?: string; showText?: boolean }

export default function DeleteCPOButton({ cpoId, refNo, ...rest }: Props) {
  return <DeleteRecordButton noun="customer PO" refNo={refNo} onDelete={() => deleteCPO(cpoId)} {...rest} />
}
