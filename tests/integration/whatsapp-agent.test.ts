/**
 * End-to-end checks of the WhatsApp agent against a REAL Postgres database,
 * with Claude stubbed (no network call, no API cost) via the `createMessage`
 * dependency-injection seam on runAgentTurn / handleWhatsAppMessage.
 *
 *   TEST_DATABASE_URL=postgresql://... npm test
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type Anthropic from "@anthropic-ai/sdk"

const TEST_DB = process.env.TEST_DATABASE_URL
const suite = TEST_DB ? describe : describe.skip

// ---- Fake Claude responses -------------------------------------------------

function textMessage(text: string): Anthropic.Beta.BetaMessage {
  return {
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn",
  } as unknown as Anthropic.Beta.BetaMessage
}

function toolUseMessage(calls: { id: string; name: string; input: unknown }[]): Anthropic.Beta.BetaMessage {
  return {
    content: calls.map(c => ({ type: "tool_use", id: c.id, name: c.name, input: c.input })),
    stop_reason: "tool_use",
  } as unknown as Anthropic.Beta.BetaMessage
}

/** Replays a fixed queue of responses, one per call; records every params object it was given. */
function stubClaude(responses: Anthropic.Beta.BetaMessage[]) {
  const queue = [...responses]
  const calls: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming[] = []
  const createMessage = async (params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming) => {
    calls.push(params)
    const next = queue.shift()
    if (!next) throw new Error("stubClaude: ran out of queued responses")
    return next
  }
  return { createMessage, calls }
}

suite("WhatsApp agent (real database)", () => {
  let prisma: typeof import("@/lib/prisma").prisma
  let executeTool: typeof import("@/lib/whatsapp/agent-tools").executeTool
  let runAgentTurn: typeof import("@/lib/whatsapp/agent").runAgentTurn
  let handleWhatsAppMessage: typeof import("@/lib/whatsapp/handle-message").handleWhatsAppMessage
  let loadConversation: typeof import("@/lib/whatsapp/conversation").loadConversation
  let catalogKey: typeof import("@/lib/catalog-key").catalogKey
  let loadWhatsAppCatalog: typeof import("@/lib/whatsapp/catalog").loadWhatsAppCatalog

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB
    process.env.DIRECT_URL = TEST_DB
    ;({ prisma } = await import("@/lib/prisma"))
    ;({ executeTool } = await import("@/lib/whatsapp/agent-tools"))
    ;({ runAgentTurn } = await import("@/lib/whatsapp/agent"))
    ;({ handleWhatsAppMessage } = await import("@/lib/whatsapp/handle-message"))
    ;({ loadConversation } = await import("@/lib/whatsapp/conversation"))
    ;({ catalogKey } = await import("@/lib/catalog-key"))
    ;({ loadWhatsAppCatalog } = await import("@/lib/whatsapp/catalog"))
  })

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "BotActionLog","BotConversation","StatusHistory","SupplierPOItem","SupplierPO","CustomerPOItem","CustomerPO","QuotationItem","QuotationSection","Quotation","Customer","Supplier","Product","Service","Counter" CASCADE',
    )
    await prisma.product.createMany({
      data: [
        { catalogKey: catalogKey("CP Plus", "2MP Dome Camera"), brand: "CP Plus", name: "2MP Dome Camera", defaultUnit: "Nos", defaultRate: 1200, defaultCost: 800 },
        { catalogKey: catalogKey("CP Plus", "4 Channel NVR"), brand: "CP Plus", name: "4 Channel NVR", defaultUnit: "Nos", defaultRate: 3500, defaultCost: 2600 },
      ],
    })
  })

  afterAll(async () => {
    await prisma?.$disconnect()
  })

  async function ctx() {
    const { byKey } = await loadWhatsAppCatalog()
    return { catalogByKey: byKey, appUrl: "https://example.test" }
  }

  describe("executeTool: create_quotation", () => {
    it("creates a Draft quotation from matched items, copying catalogue price and cost", async () => {
      const result = await executeTool(
        "create_quotation",
        { customerName: null, items: [{ description: "Dome Camera", qty: 2, brand: "CP Plus", catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }] },
        await ctx(),
      )
      expect(result.isError).toBeFalsy()
      expect(result.mutated).toBe(true)
      expect(result.content).toMatch(/Created Draft quotation MTS-/)

      const saved = await prisma.quotation.findFirstOrThrow({ include: { items: true } })
      expect(saved.items).toHaveLength(1)
      expect(saved.items[0].qty).toBe(2)
      expect(saved.items[0].sellPrice).toBe(1200)
      expect(saved.items[0].estimatedCost).toBe(800)
    })

    it("hallucination guard: an invented catalogKey is never trusted into a priced line", async () => {
      const result = await executeTool(
        "create_quotation",
        { customerName: null, items: [{ description: "Made up thing", qty: 1, brand: null, catalogKey: "nonexistent|key" }] },
        await ctx(),
      )
      expect(result.isError).toBe(true)
      expect(await prisma.quotation.count()).toBe(0)
    })

    it("reports unmatched items without losing matched ones", async () => {
      const result = await executeTool(
        "create_quotation",
        {
          customerName: null,
          items: [
            { description: "Dome Camera", qty: 1, brand: null, catalogKey: catalogKey("CP Plus", "2MP Dome Camera") },
            { description: "100m obscure cable", qty: 100, brand: null, catalogKey: null },
          ],
        },
        await ctx(),
      )
      expect(result.content).toMatch(/NOT included.*obscure cable/)
      const saved = await prisma.quotation.findFirstOrThrow({ include: { items: true } })
      expect(saved.items).toHaveLength(1) // only the matched one
    })

    it("links an unambiguous customer, leaves ambiguous/unknown ones unlinked", async () => {
      const customer = await prisma.customer.create({ data: { name: "Rajan Enterprises" } })
      await prisma.customer.create({ data: { name: "Rajan Traders" } })

      const unique = await executeTool(
        "create_quotation",
        { customerName: "Rajan Enterprises", items: [{ description: "x", qty: 1, brand: null, catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }] },
        await ctx(),
      )
      expect(unique.content).toMatch(/for Rajan Enterprises/)
      const q1 = await prisma.quotation.findFirstOrThrow()
      expect(q1.customerId).toBe(customer.id)

      await prisma.quotation.deleteMany()
      const ambiguous = await executeTool(
        "create_quotation",
        { customerName: "Rajan", items: [{ description: "x", qty: 1, brand: null, catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }] },
        await ctx(),
      )
      expect(ambiguous.content).toMatch(/Could not uniquely match customer/)
      const q2 = await prisma.quotation.findFirstOrThrow()
      expect(q2.customerId).toBeNull()
    })
  })

  describe("executeTool: read tools", () => {
    it("get_quotation resolves by exact or unambiguous partial refNo, else lists candidates", async () => {
      await executeTool("create_quotation", { customerName: null, items: [{ description: "x", qty: 1, brand: null, catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }] }, await ctx())
      const q = await prisma.quotation.findFirstOrThrow()

      const exact = await executeTool("get_quotation", { refNo: q.refNo }, await ctx())
      expect(exact.content).toMatch(new RegExp(q.refNo))

      const notFound = await executeTool("get_quotation", { refNo: "NOPE-999" }, await ctx())
      expect(notFound.isError).toBe(true)
    })

    it("list_quotations rejects an invalid status instead of silently ignoring it", async () => {
      const result = await executeTool("list_quotations", { status: "NotARealStatus", customerName: null, limit: 10 }, await ctx())
      expect(result.isError).toBe(true)
      expect(result.content).toMatch(/not a valid status/)
    })

    it("get_dashboard_summary runs with no input", async () => {
      const result = await executeTool("get_dashboard_summary", {}, await ctx())
      expect(result.isError).toBeFalsy()
      expect(result.content).toMatch(/Total customers/)
    })
  })

  describe("executeTool: status transitions reuse the same rules as the UI", () => {
    it("update_quotation_status enforces the transition table", async () => {
      await executeTool("create_quotation", { customerName: null, items: [{ description: "x", qty: 1, brand: null, catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }] }, await ctx())
      const q = await prisma.quotation.findFirstOrThrow()

      const illegal = await executeTool("update_quotation_status", { refNo: q.refNo, newStatus: "Won" }, await ctx())
      expect(illegal.isError).toBe(true)

      const legal = await executeTool("update_quotation_status", { refNo: q.refNo, newStatus: "Sent" }, await ctx())
      expect(legal.isError).toBeFalsy()
      expect((await prisma.quotation.findUniqueOrThrow({ where: { id: q.id } })).status).toBe("Sent")
    })

    it("update_supplier_po_status requires a supplier and full pricing before Sent", async () => {
      const spo = await prisma.supplierPO.create({
        data: { refNo: "SPO-TEST-1", status: "Ready For Review", items: { create: [{ productName: "Widget", qty: 1, buyPrice: null }] } },
      })
      const blocked = await executeTool("update_supplier_po_status", { refNo: spo.refNo, newStatus: "Sent" }, await ctx())
      expect(blocked.isError).toBe(true)
      expect(blocked.content).toMatch(/supplier|buy price/i)
    })
  })

  describe("executeTool: set_supplier_po_prices", () => {
    it("updates matched items by name and reports unmatched ones, touching nothing else", async () => {
      const spo = await prisma.supplierPO.create({
        data: {
          refNo: "SPO-TEST-2",
          status: "Draft",
          items: { create: [{ productName: "CP Plus 4 Channel NVR", qty: 1, buyPrice: null }, { productName: "Cat6 Cable", qty: 1, buyPrice: null }] },
        },
      })
      const result = await executeTool(
        "set_supplier_po_prices",
        { refNo: spo.refNo, prices: [{ productName: "NVR", buyPrice: 2800 }, { productName: "Something Else Entirely", buyPrice: 5 }] },
        await ctx(),
      )
      expect(result.content).toMatch(/Updated 1 price/)
      expect(result.content).toMatch(/Something Else Entirely/)
      const items = await prisma.supplierPOItem.findMany({ where: { spoId: spo.id } })
      expect(items.find(i => i.productName.includes("NVR"))?.buyPrice).toBe(2800)
      expect(items.find(i => i.productName.includes("Cat6"))?.buyPrice).toBeNull()
    })
  })

  describe("executeTool: delete tools never delete directly", () => {
    it("delete_quotation returns a pendingConfirmation and leaves the record untouched", async () => {
      await executeTool("create_quotation", { customerName: null, items: [{ description: "x", qty: 1, brand: null, catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }] }, await ctx())
      const q = await prisma.quotation.findFirstOrThrow()

      const result = await executeTool("delete_quotation", { refNo: q.refNo }, await ctx())
      expect(result.pendingConfirmation).toEqual({ tool: "delete_quotation", id: q.id, refNo: q.refNo })
      expect(await prisma.quotation.count()).toBe(1) // still there
    })
  })

  describe("handle-message: confirmation flow executes outside the model", () => {
    async function seedPendingDelete() {
      await executeTool("create_quotation", { customerName: null, items: [{ description: "x", qty: 1, brand: null, catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }] }, await ctx())
      const q = await prisma.quotation.findFirstOrThrow()
      await prisma.botConversation.create({
        data: {
          phoneNumber: "919000000001",
          messages: "[]",
          pendingConfirmation: JSON.stringify({ tool: "delete_quotation", id: q.id, refNo: q.refNo }),
          pendingExpiresAt: new Date(Date.now() + 60_000),
        },
      })
      return q
    }

    it("a clear 'yes' deletes for real, directly - no model call involved", async () => {
      const q = await seedPendingDelete()
      const { createMessage, calls } = stubClaude([]) // must NOT be called on the confirm path
      const result = await handleWhatsAppMessage({ fromPhone: "919000000001", text: "yes", createMessage })
      expect(result.replyText).toMatch(new RegExp(`Deleted quotation ${q.refNo}`))
      expect(calls).toHaveLength(0)
      expect(await prisma.quotation.count()).toBe(0)
      const convo = await prisma.botConversation.findUniqueOrThrow({ where: { phoneNumber: "919000000001" } })
      expect(convo.pendingConfirmation).toBeNull()
    })

    it("a clear 'no' cancels and keeps the record", async () => {
      const q = await seedPendingDelete()
      const result = await handleWhatsAppMessage({ fromPhone: "919000000001", text: "no", createMessage: stubClaude([]).createMessage })
      expect(result.replyText).toMatch(/Cancelled/)
      expect(await prisma.quotation.count()).toBe(1)
      const convo = await prisma.botConversation.findUniqueOrThrow({ where: { phoneNumber: "919000000001" } })
      expect(convo.pendingConfirmation).toBeNull()
      void q
    })

    it("an unrelated reply abandons the pending confirmation (never auto-deletes) and is handled as a new message", async () => {
      await seedPendingDelete()
      const { createMessage } = stubClaude([textMessage("Sure, here is the margin summary.")])
      const result = await handleWhatsAppMessage({ fromPhone: "919000000001", text: "what are my margins looking like", createMessage })
      expect(result.replyText).toMatch(/margin summary/)
      expect(await prisma.quotation.count()).toBe(1) // not deleted
      const convo = await prisma.botConversation.findUniqueOrThrow({ where: { phoneNumber: "919000000001" } })
      expect(convo.pendingConfirmation).toBeNull()
    })

    it("surfaces a business-rule failure at confirm time instead of crashing", async () => {
      await executeTool("create_quotation", { customerName: null, items: [{ description: "x", qty: 1, brand: null, catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }] }, await ctx())
      const q = await prisma.quotation.findFirstOrThrow()
      // Give it a customer PO so the delete is legitimately blocked.
      await prisma.customerPO.create({ data: { refNo: "CPO-BLOCK-1", quotationId: q.id, status: "Open" } })
      await prisma.botConversation.create({
        data: {
          phoneNumber: "919000000002",
          messages: "[]",
          pendingConfirmation: JSON.stringify({ tool: "delete_quotation", id: q.id, refNo: q.refNo }),
          pendingExpiresAt: new Date(Date.now() + 60_000),
        },
      })
      const result = await handleWhatsAppMessage({ fromPhone: "919000000002", text: "yes", createMessage: stubClaude([]).createMessage })
      expect(result.replyText).toMatch(/Could not delete/)
      expect(await prisma.quotation.count()).toBe(1) // not deleted
    })
  })

  describe("full multi-turn orchestration with a stubbed model", () => {
    it("creates a quotation via a tool call, then answers a follow-up using carried-over conversation history", async () => {
      const phone = "919000000003"

      const turn1 = stubClaude([
        toolUseMessage([{ id: "t1", name: "create_quotation", input: { customerName: null, items: [{ description: "Dome Camera", qty: 2, brand: "CP Plus", catalogKey: catalogKey("CP Plus", "2MP Dome Camera") }] } }]),
        textMessage("Done! Created the quotation."),
      ])
      const r1 = await handleWhatsAppMessage({ fromPhone: phone, text: "2 cp plus dome cameras please", createMessage: turn1.createMessage })
      expect(r1.replyText).toMatch(/Done! Created the quotation\./)
      const created = await prisma.quotation.findFirstOrThrow()

      const stored = await loadConversation(phone)
      expect(stored.messages.length).toBeGreaterThan(0)
      // Round-trips through JSON exactly as persisted (this is what saveConversation wrote and loadConversation read back).
      expect(JSON.parse(JSON.stringify(stored.messages))).toEqual(stored.messages)

      const turn2 = stubClaude([toolUseMessage([{ id: "t2", name: "get_quotation", input: { refNo: created.refNo } }]), textMessage(`It's still a Draft, ${created.refNo}.`)])
      const r2 = await handleWhatsAppMessage({ fromPhone: phone, text: "what's its status", createMessage: turn2.createMessage })
      expect(r2.replyText).toMatch(new RegExp(created.refNo))

      // The second call's request must include the first turn's history - proves conversation state actually carried across two separate handleWhatsAppMessage invocations.
      const secondRequestMessages = turn2.calls[0].messages
      expect(JSON.stringify(secondRequestMessages)).toMatch(/dome cameras please/)
    })

    it("stops at the iteration cap instead of looping forever if the model never stops calling tools", async () => {
      const alwaysToolUse = Array.from({ length: 10 }, (_, i) => toolUseMessage([{ id: `loop-${i}`, name: "get_dashboard_summary", input: {} }]))
      const { createMessage, calls } = stubClaude(alwaysToolUse)
      const result = await runAgentTurn({
        priorMessages: [],
        userMessage: "keep going forever",
        catalogPromptBlock: "",
        toolContext: await ctx(),
        createMessage,
      })
      expect(result.replyText).toMatch(/more steps/)
      expect(calls.length).toBeLessThanOrEqual(8)
    })
  })
})
