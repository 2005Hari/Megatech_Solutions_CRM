import { describe, expect, it } from "vitest"
import {
  CONVERTIBLE_QUOTATION_STATUSES,
  EDITABLE_QUOTATION_STATUSES,
  OPEN_QUOTATION_STATUSES,
  QUOTATION_STATUSES,
  REVISABLE_QUOTATION_STATUSES,
  SPO_STATUSES,
  SPO_TRANSITIONS,
  canTransitionQuotation,
  canTransitionSpo,
  statusTone,
} from "@/lib/status"

describe("quotation statuses", () => {
  it("a brand-new Draft quotation can be edited and converted", () => {
    // Regression: the UI filtered on "Pending", which nothing ever set.
    expect(EDITABLE_QUOTATION_STATUSES).toContain("Draft")
    expect(CONVERTIBLE_QUOTATION_STATUSES).toContain("Draft")
    expect(OPEN_QUOTATION_STATUSES).toContain("Draft")
  })

  it("still honours legacy 'Pending' rows", () => {
    expect(EDITABLE_QUOTATION_STATUSES).toContain("Pending")
    expect(CONVERTIBLE_QUOTATION_STATUSES).toContain("Pending")
  })

  it("closed quotations are neither editable nor convertible", () => {
    for (const s of ["Lost", "Expired", "Cancelled", "Revised"]) {
      expect(EDITABLE_QUOTATION_STATUSES).not.toContain(s)
      expect(CONVERTIBLE_QUOTATION_STATUSES).not.toContain(s)
    }
  })

  it("a draft is revised by editing, not by revision", () => {
    expect(REVISABLE_QUOTATION_STATUSES).not.toContain("Draft")
    expect(REVISABLE_QUOTATION_STATUSES).not.toContain("Won")
    expect(REVISABLE_QUOTATION_STATUSES).not.toContain("Revised")
  })

  it("Won and Revised are never manual targets", () => {
    for (const from of QUOTATION_STATUSES) {
      expect(canTransitionQuotation(from, "Won")).toBe(false)
      expect(canTransitionQuotation(from, "Revised")).toBe(false)
    }
  })

  it("allows the normal sales flow and blocks terminal states", () => {
    expect(canTransitionQuotation("Draft", "Sent")).toBe(true)
    expect(canTransitionQuotation("Sent", "Negotiation")).toBe(true)
    expect(canTransitionQuotation("Cancelled", "Draft")).toBe(false)
    expect(canTransitionQuotation("Won", "Lost")).toBe(false)
  })
})

describe("supplier PO transitions", () => {
  it("allows the forward flow", () => {
    expect(canTransitionSpo("Draft", "Ready For Review")).toBe(true)
    expect(canTransitionSpo("Ready For Review", "Sent")).toBe(true)
    expect(canTransitionSpo("Sent", "Fully Received")).toBe(true)
    expect(canTransitionSpo("Fully Received", "Closed")).toBe(true)
  })

  it("blocks skipping and reopening", () => {
    expect(canTransitionSpo("Draft", "Sent")).toBe(false)
    expect(canTransitionSpo("Closed", "Draft")).toBe(false)
    expect(canTransitionSpo("Fully Received", "Draft")).toBe(false)
  })

  it("every status has a transition entry", () => {
    for (const s of SPO_STATUSES) expect(SPO_TRANSITIONS[s]).toBeDefined()
  })
})

describe("statusTone", () => {
  it("falls back to neutral for unknown statuses", () => {
    expect(statusTone("Won")).toBe("success")
    expect(statusTone("Lost")).toBe("danger")
    expect(statusTone("???")).toBe("neutral")
  })
})
