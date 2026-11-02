import type { Prisma } from "@prisma/client"

/** A quotation as loaded for the details/edit pages. */
export type QuotationWithRelations = Prisma.QuotationGetPayload<{
  include: { customer: true; sections: { include: { items: true } }; items: true }
}>

export type Term = { id: number; label: string; value: string }

export type DocItem = {
  id: string
  brand: string
  desc: string
  qty: number
  unit: string
  rate: number
}

export type DocSection = { id: string; name: string; items: DocItem[] }

export const DEFAULT_TERMS: Term[] = [
  { id: 1, label: "GST", value: "Inclusive / Extra as applicable" },
  { id: 2, label: "Delivery Period", value: "_____ days from the date of Purchase Order" },
  { id: 3, label: "Freight Charges", value: "Inclusive / Extra as applicable" },
  { id: 4, label: "Payment", value: "100% advance with Purchase Order" },
  { id: 5, label: "Warranty", value: "As per manufacturer warranty" },
  { id: 6, label: "Validity", value: "Quotation valid for 15 days only" },
]

/** Terms are stored as a JSON string; never let bad data crash a page. */
export function parseTerms(raw: string | null | undefined): Term[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (t): t is { label: string; value: string } =>
          !!t && typeof t.label === "string" && typeof t.value === "string",
      )
      .map((t, i) => ({ id: i + 1, label: t.label, value: t.value }))
  } catch {
    return []
  }
}
