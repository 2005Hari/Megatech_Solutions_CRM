"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "./Button"
import { useFeedback } from "./Feedback"

type Props = {
  /** e.g. "quotation" - used in the confirmation text */
  noun: string
  refNo: string
  onDelete: () => Promise<ActionResult>
  redirectTo?: string
  className?: string
  showText?: boolean
}

export default function DeleteRecordButton({ noun, refNo, onDelete, redirectTo, className, showText }: Props) {
  const router = useRouter()
  const { confirm, notify } = useFeedback()
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    const ok = await confirm({
      title: `Delete ${noun} ${refNo}?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    })
    if (!ok) return

    setBusy(true)
    try {
      const res = await onDelete()
      if (!notify(res, `${noun[0].toUpperCase()}${noun.slice(1)} ${refNo} deleted.`)) return
      if (redirectTo) router.push(redirectTo)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={`Delete ${noun} ${refNo}`}
      className={className || "h-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50"}
      onClick={handleClick}
      disabled={busy}
    >
      <Trash2 className="h-4 w-4" />
      {showText && <span className="ml-2">Delete</span>}
    </Button>
  )
}
