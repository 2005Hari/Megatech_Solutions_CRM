/**
 * End-to-end checks of the server actions against a REAL Postgres database.
 *
 *   TEST_DATABASE_URL=postgresql://... npm test
 *
 * Skipped when TEST_DATABASE_URL is not set. The database is TRUNCATED, so
 * point it at a scratch database, never at real data.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB = process.env.TEST_DATABASE_URL

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock("@/lib/session", () => ({
  requireAuth: vi.fn(async () => {}),
  isAuthenticated: vi.fn(async () => true),
}))

import type { QuotationItemPayload, QuotationPayload } from "@/lib/quotation-payload"

const suite = TEST_DB ? describe : describe.skip

suite("order workflow (real database)", () => {
  // Loaded lazily so DATABASE_URL points at the test DB before Prisma starts.
  let prisma: typeof import("@/lib/prisma").prisma
  let q: typeof import("@/app/actions/quotations")
  let cpoActions: typeof import("@/app/actions/cpo")
  let spoActions: typeof import("@/app/actions/spo")
  let contacts: typeof import("@/app/actions/contacts")

  const year = new Date().getFullYear()

  const item = (over: Partial<QuotationItemPayload> = {}): QuotationItemPayload => ({
    type: "PRODUCT",
    brand: "CP Plus",
    productName: "Dome Camera",
    qty: 10,
    unit: "Nos",
    sellPrice: 1000,
    estimatedCost: 700,
    ...over,
  })

  const payload = (over: Partial<QuotationPayload> = {}): QuotationPayload => ({
    date: "2026-11-02",
    salutation: "Dear Sir",
    subject: "CCTV supply",
    type: "PRODUCT",
    includeGst: true,
    gstPct: 18,
    includeFreight: true,
    freightAmount: 500,
    terms: JSON.stringify([{ id: 1, label: "Payment", value: "100% advance" }]),
    sections: [],
    items: [item()],
    ...over,
  })

  /** Unwrap an ActionResult, failing the test with the action's message. */
  async function ok<T>(p: Promise<{ ok: true; data: T } | { ok: false; error: string }>): Promise<T> {
    const r = await p
    if (!r.ok) throw new Error(`action failed: ${r.error}`)
    return r.data
  }
  async function fail(p: Promise<{ ok: boolean; error?: string }>): Promise<string> {
    const r = await p
    expect(r.ok, "expected the action to be rejected").toBe(false)
    return (r as { error: string }).error
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB
    process.env.DIRECT_URL = TEST_DB
    ;({ prisma } = await import("@/lib/prisma"))
    q = await import("@/app/actions/quotations")
    cpoActions = await import("@/app/actions/cpo")
    spoActions = await import("@/app/actions/spo")
    contacts = await import("@/app/actions/contacts")
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "StatusHistory","SupplierPOItem","SupplierPO","CustomerPOItem","CustomerPO","QuotationItem","QuotationSection","Quotation","Customer","Supplier","Counter" CASCADE',
    )
  })

  afterAll(async () => {
    await prisma?.$disconnect()
  })

  describe("reference numbers", () => {
    it("allocates sequential numbers and never collides with existing ones", async () => {
      const a = await ok(q.createQuotation(payload()))
      const b = await ok(q.createQuotation(payload()))
      expect(a.refNo).toBe(`MTS-${year}-001`)
      expect(b.refNo).toBe(`MTS-${year}-002`)

      // someone typed the next number by hand - the allocator must skip it
      await ok(q.createQuotation(payload({ refNo: `MTS-${year}-003` })))
      const c = await ok(q.createQuotation(payload()))
      expect(c.refNo).toBe(`MTS-${year}-004`)
    })

    it("stays unique under concurrent saves", async () => {
      const results = await Promise.all(Array.from({ length: 12 }, () => q.createQuotation(payload())))
      expect(results.every(r => r.ok)).toBe(true)
      const refs = results.map(r => (r.ok ? r.data.refNo : ""))
      expect(new Set(refs).size).toBe(12)
    })

    it("rejects a duplicate manual number with a clear message", async () => {
      await ok(q.createQuotation(payload({ refNo: "CUSTOM-1" })))
      const msg = await fail(q.createQuotation(payload({ refNo: "CUSTOM-1" })))
      expect(msg).toMatch(/already in use/)
    })
  })

  describe("quotation → customer PO → supplier PO", () => {
    it("links the customer, converts atomically and copies costs", async () => {
      const customer = await ok(contacts.createContact("customer", { name: "Rajan Enterprises", contactDetails: "Pune" }))
      const created = await ok(
        q.createQuotation(
          payload({
            customerId: customer.id,
            customerAddress: "Rajan Enterprises\nPune",
            sections: [{ name: "Cameras", items: [item({ productName: "Bullet Camera", qty: 4, sellPrice: 1500, estimatedCost: 1000 })] }],
          }),
        ),
      )

      const saved = await prisma.quotation.findUniqueOrThrow({
        where: { id: created.id },
        include: { items: true, sections: { include: { items: true } } },
      })
      expect(saved.status).toBe("Draft")
      expect(saved.customerId).toBe(customer.id)
      expect(saved.customerAddress).toBe("Rajan Enterprises\nPune") // previously lost on save
      expect(saved.items).toHaveLength(2) // loose + sectioned item both belong to the quotation
      expect(saved.sections[0].items).toHaveLength(1)

      const { id: cpoId } = await ok(q.uploadCustomerPO(created.id, "PO-100", "2026-11-05", "po-100.pdf"))

      const cpo = await prisma.customerPO.findUniqueOrThrow({
        where: { id: cpoId },
        include: { items: true, supplierPOs: { include: { items: true, statusHistory: true } } },
      })
      expect(cpo.customerId).toBe(customer.id)
      expect(cpo.items).toHaveLength(2)
      expect(cpo.items.map(i => i.estimatedCost ?? 0).sort((a, b) => a - b)).toEqual([700, 1000]) // costs survive conversion

      expect((await prisma.quotation.findUniqueOrThrow({ where: { id: created.id } })).status).toBe("Won")

      expect(cpo.supplierPOs).toHaveLength(1)
      const spo = cpo.supplierPOs[0]
      expect(spo.refNo).toBe(`SPO-${year}-0001`)
      expect(spo.status).toBe("Draft")
      expect(spo.items.every(i => i.buyPrice === null)).toBe(true) // not 0
      expect(spo.statusHistory).toHaveLength(1)
    })

    it("leaves NOTHING behind when conversion fails part-way", async () => {
      const a = await ok(q.createQuotation(payload()))
      const b = await ok(q.createQuotation(payload()))
      await ok(q.uploadCustomerPO(a.id, "PO-DUP", "2026-11-05", "a.pdf"))

      const msg = await fail(q.uploadCustomerPO(b.id, "PO-DUP", "2026-11-05", "b.pdf"))
      expect(msg).toMatch(/already exists/)

      // The old code marked the quotation Won BEFORE creating the CPO.
      expect((await prisma.quotation.findUniqueOrThrow({ where: { id: b.id } })).status).toBe("Draft")
      expect(await prisma.customerPO.count({ where: { quotationId: b.id } })).toBe(0)
      expect(await prisma.supplierPO.count()).toBe(1)
    })

    it("refuses to convert a cancelled quotation", async () => {
      const a = await ok(q.createQuotation(payload()))
      await ok(q.setQuotationStatus(a.id, "Cancelled"))
      expect(await fail(q.uploadCustomerPO(a.id, "PO-X", "2026-11-05", "x.pdf"))).toMatch(/cannot be converted/)
    })
  })

  describe("editing and status rules", () => {
    it("edits a draft, replaces its lines, and locks once sent", async () => {
      const a = await ok(q.createQuotation(payload({ items: [item(), item({ productName: "NVR" })] })))
      await ok(q.updateQuotation(a.id, payload({ subject: "Updated", items: [item({ productName: "Only one" })] })))

      const after = await prisma.quotation.findUniqueOrThrow({ where: { id: a.id }, include: { items: true } })
      expect(after.subject).toBe("Updated")
      expect(after.items.map(i => i.productName)).toEqual(["Only one"])
      expect(after.refNo).toBe(a.refNo) // unchanged when none supplied

      await ok(q.setQuotationStatus(a.id, "Sent"))
      expect(await fail(q.updateQuotation(a.id, payload()))).toMatch(/can no longer be edited/)
    })

    it("enforces the status transition table", async () => {
      const a = await ok(q.createQuotation(payload()))
      expect(await fail(q.setQuotationStatus(a.id, "Won"))).toMatch(/cannot move/)
      expect(await fail(q.setQuotationStatus(a.id, "Nonsense"))).toMatch(/invalid/i)
      await ok(q.setQuotationStatus(a.id, "Sent"))
      await ok(q.setQuotationStatus(a.id, "Negotiation"))
    })

    it("rejects bad input as a result, not an exception", async () => {
      expect(await fail(q.createQuotation(payload({ items: [item({ qty: 1.5 })] })))).toMatch(/whole number/)
      expect(await fail(q.createQuotation(payload({ items: [item({ sellPrice: -5 })] })))).toMatch(/negative/)
      expect(await fail(q.createQuotation(payload({ items: [], sections: [] })))).toMatch(/at least one/)
      expect(await fail(q.createQuotation(payload({ customerId: "missing-id" })))).toMatch(/no longer exists/)
      expect(await prisma.quotation.count()).toBe(0)
    })
  })

  describe("revisions", () => {
    it("builds a chain, copies content, and blocks duplicate/stale revisions", async () => {
      const a = await ok(q.createQuotation(payload({ sections: [{ name: "S1", items: [item({ productName: "In section" })] }] })))
      expect(await fail(q.createQuotationRevision(a.id))).toMatch(/still a draft/)

      await ok(q.setQuotationStatus(a.id, "Sent"))
      const r1 = await ok(q.createQuotationRevision(a.id))
      expect(r1.refNo).toBe(`${a.refNo} Rev-1`)

      const original = await prisma.quotation.findUniqueOrThrow({ where: { id: a.id } })
      expect(original.status).toBe("Revised")

      const copy = await prisma.quotation.findUniqueOrThrow({
        where: { id: r1.id },
        include: { items: true, sections: { include: { items: true } } },
      })
      expect(copy.status).toBe("Draft")
      expect(copy.revision).toBe(1)
      expect(copy.parentQuotationId).toBe(a.id)
      expect(copy.sections).toHaveLength(1)
      expect(copy.items).toHaveLength(2)

      // the original is Revised now, so a second revision from it is refused
      // (the old code failed on a unique-constraint error after already updating it)
      expect(await fail(q.createQuotationRevision(a.id))).toMatch(/cannot be revised/)

      await ok(q.setQuotationStatus(r1.id, "Sent"))
      const r2 = await ok(q.createQuotationRevision(r1.id))
      expect(r2.refNo).toBe(`${a.refNo} Rev-2`) // not "Rev-1 Rev-2"
    })

    it("cannot delete a quotation that has revisions", async () => {
      const a = await ok(q.createQuotation(payload()))
      await ok(q.setQuotationStatus(a.id, "Sent"))
      await ok(q.createQuotationRevision(a.id))
      expect(await fail(q.deleteQuotation(a.id))).toMatch(/later revisions/)
    })
  })

  describe("deletes respect linked records", () => {
    it("blocks deleting a quotation that has a customer PO, with a readable reason", async () => {
      const a = await ok(q.createQuotation(payload()))
      await ok(q.uploadCustomerPO(a.id, "PO-1", "2026-11-05", "p.pdf"))
      expect(await fail(q.deleteQuotation(a.id))).toMatch(/customer PO/)
    })

    it("deleting a CPO removes its untouched draft SPO but not one in progress", async () => {
      const a = await ok(q.createQuotation(payload()))
      const { id: cpoId } = await ok(q.uploadCustomerPO(a.id, "PO-1", "2026-11-05", "p.pdf"))
      await ok(cpoActions.deleteCPO(cpoId))
      expect(await prisma.customerPO.count()).toBe(0)
      expect(await prisma.supplierPO.count()).toBe(0)

      const b = await ok(q.createQuotation(payload()))
      const { id: cpo2 } = await ok(q.uploadCustomerPO(b.id, "PO-2", "2026-11-05", "p.pdf"))
      const spo = await prisma.supplierPO.findFirstOrThrow({ where: { cpoId: cpo2 } })
      await prisma.supplierPO.update({ where: { id: spo.id }, data: { status: "Sent" } })
      expect(await fail(cpoActions.deleteCPO(cpo2))).toMatch(/already in progress/)
      expect(await prisma.customerPO.count()).toBe(1)
    })

    it("protects contacts that have records", async () => {
      const customer = await ok(contacts.createContact("customer", { name: "Acme" }))
      await ok(q.createQuotation(payload({ customerId: customer.id })))
      expect(await fail(contacts.deleteContact("customer", customer.id))).toMatch(/linked quotations/)
    })
  })

  describe("supplier PO lifecycle", () => {
    async function draftSpo() {
      const a = await ok(q.createQuotation(payload({ items: [item({ qty: 2 }), item({ productName: "NVR", qty: 1 })] })))
      const { id: cpoId } = await ok(q.uploadCustomerPO(a.id, `PO-${Math.random()}`, "2026-11-05", "p.pdf"))
      const spo = await prisma.supplierPO.findFirstOrThrow({ where: { cpoId }, include: { items: true } })
      return { cpoId, spo }
    }

    it("only allows legal transitions, and needs supplier + prices before sending", async () => {
      const { spo } = await draftSpo()
      expect(await fail(spoActions.transitionSPOStatus(spo.id, "Sent"))).toMatch(/cannot move/)
      await ok(spoActions.transitionSPOStatus(spo.id, "Ready For Review"))

      expect(await fail(spoActions.transitionSPOStatus(spo.id, "Sent"))).toMatch(/Assign a supplier/)

      const supplier = await ok(spoActions.createSupplierInline("D-Link India", "Mumbai"))
      await ok(
        spoActions.updateSupplierPO(spo.id, {
          refNo: spo.refNo,
          date: "2026-11-06",
          supplierId: supplier.id,
          items: [{ id: spo.items[0].id, productName: spo.items[0].productName, qty: 2, buyPrice: 600 }, { id: spo.items[1].id, productName: "NVR", qty: 1, buyPrice: null }],
        }),
      )
      expect(await fail(spoActions.transitionSPOStatus(spo.id, "Sent"))).toMatch(/buy price for every item/)

      await ok(
        spoActions.updateSupplierPO(spo.id, {
          refNo: spo.refNo,
          date: "2026-11-06",
          supplierId: supplier.id,
          items: [{ id: spo.items[0].id, productName: spo.items[0].productName, qty: 2, buyPrice: 600 }, { id: spo.items[1].id, productName: "NVR", qty: 1, buyPrice: 650 }],
        }),
      )
      await ok(spoActions.transitionSPOStatus(spo.id, "Sent"))

      // now frozen
      expect(await fail(spoActions.updateSupplierPO(spo.id, { refNo: spo.refNo, date: "2026-11-06", items: [{ productName: "x", qty: 1 }] }))).toMatch(/can no longer be edited/)
      expect(await fail(spoActions.deleteSPO(spo.id))).toMatch(/already gone to the supplier/)
      expect(await fail(spoActions.transitionSPOStatus(spo.id, "Draft"))).toMatch(/cannot move/)
    })

    it("a PO cannot edit items belonging to another PO", async () => {
      const { spo: first } = await draftSpo()
      const { spo: second } = await draftSpo()
      const msg = await fail(
        spoActions.updateSupplierPO(first.id, {
          refNo: first.refNo,
          date: "2026-11-06",
          items: [{ id: second.items[0].id, productName: "hijack", qty: 1, buyPrice: 1 }],
        }),
      )
      expect(msg).toMatch(/does not belong/)
      const untouched = await prisma.supplierPOItem.findUniqueOrThrow({ where: { id: second.items[0].id } })
      expect(untouched.productName).not.toBe("hijack")
    })

    it("marks the CPO fulfilled only when EVERY supplier PO is received", async () => {
      const { cpoId, spo } = await draftSpo()
      const supplier = await prisma.supplier.create({ data: { name: "S" } })

      // a second supplier PO raised for the same customer order
      const second = await prisma.supplierPO.create({
        data: {
          refNo: "SPO-MANUAL-2",
          cpoId,
          supplierId: supplier.id,
          status: "Sent",
          items: { create: [{ productName: "Extra", qty: 1, buyPrice: 10 }] },
        },
      })
      await prisma.supplierPO.update({
        where: { id: spo.id },
        data: { status: "Sent", supplierId: supplier.id, items: { updateMany: { where: {}, data: { buyPrice: 5 } } } },
      })

      await ok(spoActions.transitionSPOStatus(spo.id, "Fully Received"))
      expect((await prisma.customerPO.findUniqueOrThrow({ where: { id: cpoId } })).status).toBe("Open") // old code: Fulfilled

      await ok(spoActions.transitionSPOStatus(second.id, "Fully Received"))
      expect((await prisma.customerPO.findUniqueOrThrow({ where: { id: cpoId } })).status).toBe("Fulfilled")
    })
  })
})
