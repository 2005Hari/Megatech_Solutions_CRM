import { statusTone, type BadgeTone } from "@/lib/status"

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-muted/50 text-muted-foreground border border-card-border",
  warning: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
  info: "bg-accent/10 text-accent border border-accent/20",
  success: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
  danger: "bg-rose-500/10 text-rose-600 border border-rose-500/20",
}

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${TONE_CLASSES[statusTone(status)]} ${className}`}
    >
      {status}
    </span>
  )
}
