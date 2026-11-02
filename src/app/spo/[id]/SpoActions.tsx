"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Lock } from "lucide-react"
import { transitionSPOStatus } from "@/app/actions/spo"
import { useFeedback } from "@/components/ui/Feedback"

type Props = { spoId: string; status: string }

const primary = "px-4 py-2 bg-accent hover:bg-accent/90 text-accent-foreground rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
const secondary = "px-4 py-2 border border-card-border hover:bg-muted text-foreground rounded-lg text-sm font-medium transition-colors disabled:opacity-50"

/**
 * Status buttons for a supplier PO. These used to be inline server actions on
 * the page that ignored failures; now an illegal move shows the reason.
 */
export default function SpoActions({ spoId, status }: Props) {
  const router = useRouter()
  const { notify } = useFeedback()
  const [busy, setBusy] = useState(false)

  const move = async (next: string, message: string) => {
    setBusy(true)
    try {
      const res = await transitionSPOStatus(spoId, next)
      if (notify(res, message)) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  switch (status) {
    case "Draft":
      return (
        <button disabled={busy} onClick={() => move("Ready For Review", "Marked ready for review.")} className={primary}>
          Mark Ready for Review
        </button>
      )
    case "Ready For Review":
      return (
        <>
          <button disabled={busy} onClick={() => move("Sent", "Marked as sent to supplier.")} className={primary}>
            Mark as Sent to Supplier
          </button>
          <button disabled={busy} onClick={() => move("Draft", "Reset to draft.")} className={secondary}>
            Reset to Draft
          </button>
        </>
      )
    case "Sent":
      return (
        <>
          <button
            disabled={busy}
            onClick={() => move("Partially Received", "Marked as partially received.")}
            className={secondary}
          >
            Partially Received
          </button>
          <button
            disabled={busy}
            onClick={() => move("Fully Received", "Marked as fully received.")}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <CheckCircle2 size={16} /> Mark as Received
          </button>
          <button disabled={busy} onClick={() => move("Ready For Review", "Moved back to review.")} className={secondary}>
            Back to Review
          </button>
        </>
      )
    case "Partially Received":
      return (
        <button
          disabled={busy}
          onClick={() => move("Fully Received", "Marked as fully received.")}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <CheckCircle2 size={16} /> Mark as Fully Received
        </button>
      )
    case "Fully Received":
      return (
        <button disabled={busy} onClick={() => move("Closed", "PO closed.")} className={primary}>
          <Lock size={16} /> Close PO
        </button>
      )
    default:
      return null
  }
}
