"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/Button"

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="p-8 max-w-xl mx-auto">
      <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm mt-1">This page could not be loaded. You can try again, and if it keeps happening let us know.</p>
        {error.digest && <p className="text-xs mt-2 opacity-70">Reference: {error.digest}</p>}
        <Button className="mt-4" onClick={reset}>Try again</Button>
      </div>
    </div>
  )
}
