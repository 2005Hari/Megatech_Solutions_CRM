/**
 * Single source of truth for workflow statuses.
 *
 * Statuses are stored as plain strings in the database, so every place that
 * compares against a status must use these constants - a typo here previously
 * left the "Pending" filter matching nothing.
 */

// ---------------------------------------------------------------- Quotations

export const QUOTATION_STATUSES = [
  "Draft",
  "Pending Approval",
  "Sent",
  "Customer Review",
  "Negotiation",
  "Revised",
  "Won",
  "Lost",
  "Expired",
  "Cancelled",
] as const
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number]

/**
 * "Pending" was the original default status. Existing rows may still carry
 * it, so it is treated as an alias for an open, editable quotation.
 */
export const LEGACY_PENDING = "Pending"

/** Quotations whose content can still be edited. */
export const EDITABLE_QUOTATION_STATUSES: readonly string[] = [
  "Draft",
  "Pending Approval",
  LEGACY_PENDING,
]

/** Quotations a customer PO can be recorded against. */
export const CONVERTIBLE_QUOTATION_STATUSES: readonly string[] = [
  "Draft",
  "Pending Approval",
  LEGACY_PENDING,
  "Sent",
  "Customer Review",
  "Negotiation",
  "Won", // customers may send several POs against one quotation
]

/** Quotations that are still "open" (used for the dashboard counter). */
export const OPEN_QUOTATION_STATUSES: readonly string[] = [
  "Draft",
  "Pending Approval",
  LEGACY_PENDING,
  "Sent",
  "Customer Review",
  "Negotiation",
]

/** Quotations a new revision can be raised from. */
export const REVISABLE_QUOTATION_STATUSES: readonly string[] = [
  LEGACY_PENDING,
  "Pending Approval",
  "Sent",
  "Customer Review",
  "Negotiation",
  "Lost",
  "Expired",
]

/**
 * Manual status changes. "Won" is reached only by recording a customer PO and
 * "Revised" only by creating a revision, so neither appears as a target here.
 */
export const QUOTATION_TRANSITIONS: Record<string, readonly string[]> = {
  Draft: ["Sent", "Cancelled"],
  "Pending Approval": ["Draft", "Sent", "Cancelled"],
  [LEGACY_PENDING]: ["Draft", "Sent", "Lost", "Cancelled"],
  Sent: ["Draft", "Customer Review", "Negotiation", "Lost", "Expired", "Cancelled"],
  "Customer Review": ["Negotiation", "Lost", "Expired", "Cancelled"],
  Negotiation: ["Customer Review", "Lost", "Expired", "Cancelled"],
  Revised: [],
  Won: [],
  Lost: [],
  Expired: [],
  Cancelled: [],
}

export function canTransitionQuotation(from: string, to: string): boolean {
  return (QUOTATION_TRANSITIONS[from] ?? []).includes(to)
}

// ------------------------------------------------------------ Customer POs

export const CPO_STATUSES = ["Open", "Fulfilled", "Cancelled"] as const
export type CpoStatus = (typeof CPO_STATUSES)[number]

// ------------------------------------------------------------ Supplier POs

export const SPO_STATUSES = [
  "Draft",
  "Ready For Review",
  "Sent",
  "Partially Received",
  "Fully Received",
  "Closed",
] as const
export type SpoStatus = (typeof SPO_STATUSES)[number]

export const SPO_TRANSITIONS: Record<SpoStatus, readonly SpoStatus[]> = {
  Draft: ["Ready For Review"],
  "Ready For Review": ["Sent", "Draft"],
  Sent: ["Partially Received", "Fully Received", "Ready For Review"],
  "Partially Received": ["Fully Received"],
  "Fully Received": ["Closed"],
  Closed: [],
}

export function canTransitionSpo(from: string, to: string): boolean {
  return ((SPO_TRANSITIONS as Record<string, readonly string[]>)[from] ?? []).includes(to)
}

/** SPO statuses in which the content (items, prices, supplier) can be edited. */
export const EDITABLE_SPO_STATUSES: readonly string[] = ["Draft", "Ready For Review"]

/** SPO statuses that count as "done" when deciding if a CPO is fulfilled. */
export const RECEIVED_SPO_STATUSES: readonly string[] = ["Fully Received", "Closed"]

// ----------------------------------------------------------- Badge styling

export type BadgeTone = "neutral" | "warning" | "info" | "success" | "danger"

const TONES: Record<string, BadgeTone> = {
  Draft: "neutral",
  "Pending Approval": "warning",
  [LEGACY_PENDING]: "warning",
  "Ready For Review": "warning",
  Open: "warning",
  Sent: "info",
  "Customer Review": "info",
  Negotiation: "info",
  "Partially Received": "info",
  Revised: "neutral",
  Won: "success",
  Fulfilled: "success",
  "Fully Received": "success",
  Closed: "neutral",
  Lost: "danger",
  Expired: "danger",
  Cancelled: "danger",
}

export function statusTone(status: string): BadgeTone {
  return TONES[status] ?? "neutral"
}
