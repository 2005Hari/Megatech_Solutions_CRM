"use client"

import { useEffect } from "react"

/** Opens the browser print dialog once the document has rendered. */
export default function AutoPrint() {
  useEffect(() => {
    window.print()
  }, [])
  return null
}
