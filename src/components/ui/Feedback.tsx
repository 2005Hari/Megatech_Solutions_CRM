"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Info, X, XCircle } from "lucide-react"
import type { ActionResult } from "@/lib/action-result"
import { Button } from "./Button"

type ToastKind = "success" | "error" | "info"
type ToastItem = { id: number; kind: ToastKind; message: string }

type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  destructive?: boolean
}

type FeedbackApi = {
  toast: (message: string, kind?: ToastKind) => void
  /** Resolves true if the user confirms. Replaces window.confirm(). */
  confirm: (options: ConfirmOptions) => Promise<boolean>
  /**
   * Show the outcome of a server action. Returns true on success so callers
   * can write `if (!notify(res, "Saved")) return`.
   */
  notify: <T>(result: ActionResult<T>, successMessage?: string) => result is { ok: true; data: T }
}

const FeedbackContext = createContext<FeedbackApi | null>(null)

export function useFeedback(): FeedbackApi {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>")
  return ctx
}

const TOAST_MS = 5000

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), [])

  const toast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = nextId.current++
      setToasts(t => [...t, { id, kind, message }])
      window.setTimeout(() => dismiss(id), TOAST_MS)
    },
    [dismiss],
  )

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>(resolve => setDialog({ ...options, resolve })),
    [],
  )

  const notify = useCallback(
    <T,>(result: ActionResult<T>, successMessage?: string): result is { ok: true; data: T } => {
      if (result.ok) {
        if (successMessage) toast(successMessage, "success")
        return true
      }
      toast(result.error, "error")
      return false
    },
    [toast],
  )

  const closeDialog = (value: boolean) => {
    dialog?.resolve(value)
    setDialog(null)
  }

  useEffect(() => {
    if (!dialog) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dialog.resolve(false)
        setDialog(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dialog])

  const api = useMemo(() => ({ toast, confirm, notify }), [toast, confirm, notify])

  return (
    <FeedbackContext.Provider value={api}>
      {children}

      <div className="fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2" aria-live="polite">
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`flex items-start gap-2 rounded-lg border bg-card p-3 text-sm shadow-lg ${
              t.kind === "error"
                ? "border-rose-300 text-rose-700"
                : t.kind === "success"
                  ? "border-emerald-300 text-emerald-700"
                  : "border-card-border text-foreground"
            }`}
          >
            {t.kind === "error" ? (
              <XCircle size={16} className="mt-0.5 shrink-0" />
            ) : t.kind === "success" ? (
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
            ) : (
              <Info size={16} className="mt-0.5 shrink-0" />
            )}
            <span className="flex-1 break-words">{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="w-full max-w-sm rounded-xl border border-card-border bg-card p-6 shadow-xl"
          >
            <h2 id="confirm-title" className="text-base font-semibold text-foreground">
              {dialog.title}
            </h2>
            {dialog.message && <p className="mt-2 text-sm text-muted-foreground">{dialog.message}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => closeDialog(false)}>
                Cancel
              </Button>
              <Button variant={dialog.destructive ? "danger" : "default"} onClick={() => closeDialog(true)} autoFocus>
                {dialog.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}
