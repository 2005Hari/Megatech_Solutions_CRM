/**
 * End-to-end check of the WhatsApp requirement pipeline against a REAL
 * Postgres database, with Claude stubbed (no network call, no API cost).
 *
 *   TEST_DATABASE_URL=postgresql://... npm test
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

const TEST_DB = process.env.TEST_DATABASE_URL
const suite = TEST_DB ? describe : describe.skip

suite("WhatsApp requirement -> quotation (real database)", () => {
  let prisma: typeof import("@/lib/prisma").prisma
  let handleWhatsAppRequirement: typeof import("@/lib/whatsapp/handle-requirement").handleWhatsAppRequirement
  let catalogKey: typeof import("@/lib/catalog-key").catalogKey

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB
    process.env.DIRECT_URL = TEST_DB
    ;({ prisma } = await import("@/lib/prisma"))
    ;({ handleWhatsAppRequirement } = await import("@/lib/whatsapp/handle-requirement"))
    ;({ catalogKey } = await import("@/lib/catalog-key"))
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "BotRequirementLog","StatusHistory","SupplierPOItem","SupplierPO","CustomerPOItem","CustomerPO","QuotationItem","QuotationSection","Quotation","Customer","Supplier","Product","Service","Counter" CASCADE',
    )
    await prisma.product.createMany({
      data: [
        {
          catalogKey: catalogKey("CP Plus", "2MP Dome Camera"),
          brand: "CP Plus",
          name: "2MP Dome Camera",
          defaultUnit: "Nos",
          defaultRate: 1200,
          defaultCost: 800,
        },
        {
          catalogKey: catalogKey("CP Plus", "4 Channel NVR"),
          brand: "CP Plus",
          name: "4 Channel NVR",
          defaultUnit: "Nos",
          defaultRate: 3500,
          defaultCost: 2600,
        },
      ],
    })
  })

  afterAll(async () => {
    await prisma?.$disconnect()
  })

  it("creates a Draft quotation from matched lines, copying catalogue price and cost", async () => {
    const result = await handleWhatsAppRequirement({
      fromPhone: "919876543210",
      rawMessage: "2 dome cameras and 1 nvr please",
      extractor: async () => ({
        customerHint: null,
        lines: [
          { description: "Dome Camera", qty: 2, unit: null, brand: "CP Plus", catalogKey: catalogKey("CP Plus", "2MP Dome Camera") },
          { description: "NVR", qty: 1, unit: null, brand: "CP Plus", catalogKey: catalogKey("CP Plus", "4 Channel NVR") },
        ],
      }),
    })

    expect(result.quotationId).not.toBeNull()
    expect(result.matched).toHaveLength(2)
    expect(result.unmatched).toHaveLength(0)

    const saved = await prisma.quotation.findUniqueOrThrow({
      where: { id: result.quotationId! },
      include: { items: true },
    })
    expect(saved.status).toBe("Draft")
    expect(saved.customerId).toBeNull()
    expect(saved.items).toHaveLength(2)
    const camera = saved.items.find(i => i.productName.includes("Dome"))!
    expect(camera.qty).toBe(2)
    expect(camera.sellPrice).toBe(1200)
    expect(camera.estimatedCost).toBe(800)

    expect(result.replyText).toMatch(/Quotation MTS-/)
    expect(result.replyText).toMatch(/₹2,400/) // 2 x 1200
    expect(result.replyText).not.toMatch(/Not included/) // nothing unmatched

    const log = await prisma.botRequirementLog.findFirstOrThrow({ where: { fromPhone: "919876543210" } })
    expect(log.status).toBe("QUOTATION_CREATED")
    expect(log.matchedCount).toBe(2)
    expect(log.quotationId).toBe(result.quotationId)
  })

  it("never guesses a price: an unmatched line is left out of the quotation and named in the reply, not silently dropped or priced at 0", async () => {
    const result = await handleWhatsAppRequirement({
      fromPhone: "919876543210",
      rawMessage: "2 dome cameras and 100m of some obscure cable",
      extractor: async () => ({
        customerHint: null,
        lines: [
          { description: "Dome Camera", qty: 2, unit: null, brand: "CP Plus", catalogKey: catalogKey("CP Plus", "2MP Dome Camera") },
          { description: "100m obscure cable", qty: 100, unit: "m", brand: null, catalogKey: null },
        ],
      }),
    })

    expect(result.matched).toHaveLength(1)
    expect(result.unmatched).toEqual([{ description: "100m obscure cable", qty: 100, unit: "m", brand: null }])

    const saved = await prisma.quotation.findUniqueOrThrow({ where: { id: result.quotationId! }, include: { items: true } })
    expect(saved.items).toHaveLength(1) // the unmatched line is NOT in the quotation
    expect(saved.items.some(i => i.sellPrice === 0)).toBe(false) // and never priced at 0 either

    expect(result.replyText).toMatch(/Not included/)
    expect(result.replyText).toMatch(/obscure cable/)

    const log = await prisma.botRequirementLog.findFirstOrThrow({ where: { fromPhone: "919876543210" } })
    expect(JSON.parse(log.unmatchedItems!)).toHaveLength(1)
  })

  it("creates nothing when nothing matches - no empty quotation, reply explains why", async () => {
    const result = await handleWhatsAppRequirement({
      fromPhone: "919876543210",
      rawMessage: "some totally unrelated stuff",
      extractor: async () => ({
        customerHint: null,
        lines: [{ description: "totally unrelated stuff", qty: 1, unit: null, brand: null, catalogKey: null }],
      }),
    })

    expect(result.quotationId).toBeNull()
    expect(await prisma.quotation.count()).toBe(0)
    expect(result.replyText).toMatch(/Couldn't match/)

    const log = await prisma.botRequirementLog.findFirstOrThrow({ where: { fromPhone: "919876543210" } })
    expect(log.status).toBe("PARSED")
    expect(log.quotationId).toBeNull()
  })

  it("links the customer only when the hint resolves to exactly one existing contact", async () => {
    const customer = await prisma.customer.create({ data: { name: "Rajan Enterprises", contactDetails: "Pune" } })
    await prisma.customer.create({ data: { name: "Rajan Traders" } }) // ambiguous sibling name

    const unique = await handleWhatsAppRequirement({
      fromPhone: "919876543210",
      rawMessage: "Customer: Rajan Enterprises\n1 dome camera",
      extractor: async () => ({
        customerHint: "Rajan Enterprises",
        lines: [{ description: "Dome Camera", qty: 1, unit: null, brand: null, catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }],
      }),
    })
    expect(unique.customer?.id).toBe(customer.id)
    expect(unique.replyText).toMatch(/for Rajan Enterprises/)

    const ambiguous = await handleWhatsAppRequirement({
      fromPhone: "919876543210",
      rawMessage: "Customer: Rajan\n1 dome camera",
      extractor: async () => ({
        customerHint: "Rajan",
        lines: [{ description: "Dome Camera", qty: 1, unit: null, brand: null, catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }],
      }),
    })
    expect(ambiguous.customer).toBeNull()
    expect(ambiguous.replyText).toMatch(/Couldn't match customer/)
  })

  it("a hallucinated catalogKey (not in the database) is never trusted into a priced line", async () => {
    const result = await handleWhatsAppRequirement({
      fromPhone: "919876543210",
      rawMessage: "1 imaginary product",
      extractor: async () => ({
        customerHint: null,
        lines: [{ description: "Imaginary Product", qty: 1, unit: null, brand: null, catalogKey: "nonexistent|key" }],
      }),
    })
    expect(result.matched).toHaveLength(0)
    expect(result.quotationId).toBeNull()
  })

  it("logs FAILED (and still throws) when extraction itself errors, so staff is not left thinking it worked", async () => {
    await expect(
      handleWhatsAppRequirement({
        fromPhone: "919876543210",
        rawMessage: "anything",
        extractor: async () => {
          throw new Error("simulated model failure")
        },
      }),
    ).rejects.toThrow("simulated model failure")

    const log = await prisma.botRequirementLog.findFirstOrThrow({ where: { fromPhone: "919876543210" } })
    expect(log.status).toBe("FAILED")
    expect(log.errorMessage).toMatch(/simulated model failure/)
  })

  it("quantities round to whole numbers and never fall below 1", async () => {
    const result = await handleWhatsAppRequirement({
      fromPhone: "919876543210",
      rawMessage: "a few dome cameras",
      extractor: async () => ({
        customerHint: null,
        lines: [{ description: "Dome Camera", qty: 2.6, unit: null, brand: null, catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }],
      }),
    })
    const saved = await prisma.quotation.findUniqueOrThrow({ where: { id: result.quotationId! }, include: { items: true } })
    expect(saved.items[0].qty).toBe(3)
  })
})
