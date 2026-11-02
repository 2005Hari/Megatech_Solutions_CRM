import { z } from "zod"
import type Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import { UserError } from "@/lib/errors"
import { toUserMessage } from "@/lib/action-result"
import { QUOTATION_STATUSES, SPO_STATUSES } from "@/lib/status"
import { cpoFinance } from "@/lib/finance"
import { calcQuotationTotals } from "@/lib/totals"
import { formatCurrency } from "@/lib/utils"
import { createQuotationCore } from "@/lib/quotation-create"
import type { ValidItem, ValidQuotation } from "@/lib/quotation-payload"
import { setQuotationStatusCore } from "@/lib/quotation-status-core"
import { transitionSpoStatusCore } from "@/lib/spo-status-core"
import { setSpoItemPricesCore } from "@/lib/spo-prices-core"
import type { CatalogEntry } from "./catalog"
import { formatCustomerPo, formatQuotation, formatSupplierPo } from "./agent-format"
import { resolveCustomerByName, resolveCustomerPoByRef, resolveQuotationByRef, resolveSupplierPoByRef } from "./agent-resolve"

/** Everything a tool call needs besides its own input. Loaded once per incoming message. */
export type AgentToolContext = { catalogByKey: Map<string, CatalogEntry>; appUrl: string }

export type PendingConfirmation =
  | { tool: "delete_quotation"; id: string; refNo: string }
  | { tool: "delete_customer_po"; id: string; refNo: string }
  | { tool: "delete_supplier_po"; id: string; refNo: string }

export type ToolExecutionResult = {
  content: string
  isError?: boolean
  /** True when this call actually changed data (for the audit log). */
  mutated?: boolean
  /** Set by a delete_* tool instead of deleting - see handle-message.ts. */
  pendingConfirmation?: PendingConfirmation
}

function toTool(name: string, description: string, schema: z.ZodType): Anthropic.Beta.BetaTool {
  const schemaObj = z.toJSONSchema(schema) as Record<string, unknown>
  delete schemaObj.$schema
  return {
    name,
    description,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input_schema: schemaObj as any,
    strict: true,
  }
}

const STATUS_LIST = (list: readonly string[]) => list.join(", ")

// --------------------------------------------------------------- Read tools

const GetQuotationInput = z.object({ refNo: z.string().describe("The quotation reference number, e.g. MTS-2026-014") })
const ListQuotationsInput = z.object({
  status: z.string().nullable().describe(`Filter by status, one of: ${STATUS_LIST(QUOTATION_STATUSES)}. Null for all.`),
  customerName: z.string().nullable().describe("Filter by customer name (partial match). Null for all."),
  limit: z.number().int().min(1).max(25).describe("Max rows to return."),
})
const GetCustomerPoInput = z.object({ refNo: z.string().describe("The customer PO reference number") })
const ListCustomerPosInput = z.object({
  status: z.string().nullable().describe("Filter by status: Open, Fulfilled, or Cancelled. Null for all."),
  limit: z.number().int().min(1).max(25),
})
const GetSupplierPoInput = z.object({ refNo: z.string().describe("The supplier PO reference number") })
const ListSupplierPosInput = z.object({
  status: z.string().nullable().describe(`Filter by status: ${STATUS_LIST(SPO_STATUSES)}. Null for all.`),
  limit: z.number().int().min(1).max(25),
})
const GetCustomerProfileInput = z.object({ name: z.string().describe("Customer name (partial match is fine)") })
const GetDashboardSummaryInput = z.object({})
const GetMarginsSummaryInput = z.object({ limit: z.number().int().min(1).max(15).describe("How many best/worst orders to show") })

// -------------------------------------------------------------- Write tools

const QuotationItemInput = z.object({
  description: z.string().describe("Line description, cleaned up for the quotation"),
  qty: z.number().describe("Quantity. Will be rounded to a whole number, minimum 1."),
  brand: z.string().nullable().describe("Brand, if known"),
  catalogKey: z
    .string()
    .nullable()
    .describe(
      "The EXACT catalogKey from the catalogue given in your system prompt, copied verbatim - or null if nothing matches confidently. Never invent one.",
    ),
})
const CreateQuotationInput = z.object({
  customerName: z.string().nullable().describe("Customer/company name, if stated. Null if not mentioned."),
  items: z.array(QuotationItemInput).min(1),
})
const UpdateQuotationStatusInput = z.object({
  refNo: z.string(),
  newStatus: z.string().describe(`One of: ${STATUS_LIST(QUOTATION_STATUSES)}`),
})
const UpdateSupplierPoStatusInput = z.object({
  refNo: z.string(),
  newStatus: z.string().describe(`One of: ${STATUS_LIST(SPO_STATUSES)}`),
})
const SpoPriceInput = z.object({
  productName: z.string().describe("Enough of the product name to identify the line uniquely on that PO"),
  buyPrice: z.number().describe("Buy price per unit"),
})
const SetSupplierPoPricesInput = z.object({ refNo: z.string(), prices: z.array(SpoPriceInput).min(1) })

// ------------------------------------------------------------- Delete tools

const DeleteQuotationInput = z.object({ refNo: z.string() })
const DeleteCustomerPoInput = z.object({ refNo: z.string() })
const DeleteSupplierPoInput = z.object({ refNo: z.string() })

export const AGENT_TOOLS: Anthropic.Beta.BetaTool[] = [
  toTool("get_quotation", "Look up one quotation by reference number: status, items, totals, expected profit.", GetQuotationInput),
  toTool("list_quotations", "List quotations, optionally filtered by status and/or customer.", ListQuotationsInput),
  toTool("get_customer_po", "Look up one customer purchase order by reference number, with revenue/profit.", GetCustomerPoInput),
  toTool("list_customer_pos", "List customer purchase orders, optionally filtered by status.", ListCustomerPosInput),
  toTool("get_supplier_po", "Look up one supplier purchase order by reference number, with items and prices.", GetSupplierPoInput),
  toTool("list_supplier_pos", "List supplier purchase orders, optionally filtered by status.", ListSupplierPosInput),
  toTool("get_customer_profile", "Look up a customer: contact details, lifetime revenue, quotation/order counts.", GetCustomerProfileInput),
  toTool("get_dashboard_summary", "Overall business snapshot: revenue, expected/actual profit, open counts.", GetDashboardSummaryInput),
  toTool("get_margins_summary", "Best and worst margin customer orders, among fully-priced ones.", GetMarginsSummaryInput),
  toTool(
    "create_quotation",
    "Create a new Draft quotation from a list of items. Use the catalogue in your system prompt to resolve each item to a catalogKey when confident; leave catalogKey null otherwise rather than guessing - unmatched items are reported back, not priced.",
    CreateQuotationInput,
  ),
  toTool("update_quotation_status", "Move a quotation to a new status (must be a legal transition).", UpdateQuotationStatusInput),
  toTool("update_supplier_po_status", "Move a supplier PO to a new status (must be a legal transition).", UpdateSupplierPoStatusInput),
  toTool(
    "set_supplier_po_prices",
    "Set the buy price on one or more EXISTING items of a supplier PO, matched by (partial) product name. Cannot add, remove, or rename items.",
    SetSupplierPoPricesInput,
  ),
  toTool(
    "delete_quotation",
    "Request deletion of a quotation. This does NOT delete immediately - it asks the user to confirm first. Only use when the user clearly asked to delete something.",
    DeleteQuotationInput,
  ),
  toTool(
    "delete_customer_po",
    "Request deletion of a customer PO. This does NOT delete immediately - it asks the user to confirm first.",
    DeleteCustomerPoInput,
  ),
  toTool(
    "delete_supplier_po",
    "Request deletion of a supplier PO. This does NOT delete immediately - it asks the user to confirm first.",
    DeleteSupplierPoInput,
  ),
]

function toValidItem(desc: string, qty: number, brand: string | null, entry: CatalogEntry): ValidItem {
  return {
    type: entry.type,
    brand: entry.brand,
    productName: entry.brand ? `${entry.brand} ${entry.name}` : entry.name,
    qty,
    unit: entry.unit,
    sellPrice: entry.sellPrice,
    estimatedCost: entry.estimatedCost,
    laborCost: null,
    materialCost: null,
    transportCost: null,
    otherCost: null,
  }
}

function normalizeQty(qty: number): number {
  const n = Math.round(qty)
  return Number.isFinite(n) && n > 0 ? n : 1
}

async function handleCreateQuotation(input: z.infer<typeof CreateQuotationInput>, ctx: AgentToolContext): Promise<ToolExecutionResult> {
  const matched: ValidItem[] = []
  const unmatched: string[] = []

  for (const item of input.items) {
    // Hallucination guard: a catalogKey the model invents (not actually in
    // the catalogue it was given) is never trusted - exact lookup only.
    const entry = item.catalogKey ? ctx.catalogByKey.get(item.catalogKey) : undefined
    if (entry) {
      matched.push(toValidItem(item.description, normalizeQty(item.qty), item.brand, entry))
    } else {
      unmatched.push(item.description)
    }
  }

  if (matched.length === 0) {
    return {
      content: `None of the items matched the catalogue, so no quotation was created. Unmatched: ${unmatched.join(", ")}. Tell the user to add these to the Product catalogue in Settings, or describe them differently.`,
      isError: true,
    }
  }

  let customer: { id: string; name: string; contactDetails: string | null } | null = null
  let customerNote = ""
  if (input.customerName) {
    const resolved = await resolveCustomerByName(input.customerName)
    if (resolved && "id" in resolved) {
      customer = resolved
    } else if (resolved && "ambiguous" in resolved) {
      customerNote = ` Could not uniquely match customer "${input.customerName}" (candidates: ${resolved.ambiguous.join(", ")}) - quotation left unlinked.`
    } else {
      customerNote = ` Could not find a customer named "${input.customerName}" - quotation left unlinked.`
    }
  }

  const allProduct = matched.every(m => m.type === "PRODUCT")
  const allService = matched.every(m => m.type === "SERVICE")
  const data: ValidQuotation = {
    customerId: customer?.id ?? null,
    customerAddress: customer ? customer.name + (customer.contactDetails ? `\n${customer.contactDetails}` : "") : null,
    refNo: null,
    date: new Date(),
    validUntil: null,
    salutation: "Dear Sir / Madam,",
    subject: null,
    type: allProduct ? "PRODUCT" : allService ? "SERVICE" : "MIXED",
    includeGst: true,
    gstPct: 18,
    includeFreight: false,
    freightAmount: 0,
    terms: "[]",
    sections: [],
    items: matched,
  }

  const created = await createQuotationCore(data)
  const totals = calcQuotationTotals({
    lines: matched.map(m => ({ qty: m.qty, price: m.sellPrice, cost: m.estimatedCost })),
    includeGst: true,
    gstPct: 18,
    includeFreight: false,
    freightAmount: 0,
  })

  const summary = [
    `Created Draft quotation ${created.refNo}${customer ? ` for ${customer.name}` : ""}.${customerNote}`,
    `${matched.length} item(s) included, grand total ${formatCurrency(totals.grandTotal)} (incl. 18% GST).`,
    unmatched.length > 0 ? `NOT included (not in catalogue): ${unmatched.join(", ")}.` : null,
    ctx.appUrl ? `Review/send: ${ctx.appUrl}/quotations/${created.id}` : null,
  ]
    .filter((l): l is string => l !== null)
    .join(" ")

  return { content: summary, mutated: true }
}

async function handleUpdateQuotationStatus(input: z.infer<typeof UpdateQuotationStatusInput>): Promise<ToolExecutionResult> {
  const q = await resolveQuotationByRef(input.refNo)
  await setQuotationStatusCore(q.id, input.newStatus)
  return { content: `Quotation ${q.refNo} moved to "${input.newStatus}".`, mutated: true }
}

async function handleUpdateSupplierPoStatus(input: z.infer<typeof UpdateSupplierPoStatusInput>): Promise<ToolExecutionResult> {
  const spo = await resolveSupplierPoByRef(input.refNo)
  await transitionSpoStatusCore(spo.id, input.newStatus)
  return { content: `Supplier PO ${spo.refNo} moved to "${input.newStatus}".`, mutated: true }
}

async function handleSetSupplierPoPrices(input: z.infer<typeof SetSupplierPoPricesInput>): Promise<ToolExecutionResult> {
  const spo = await resolveSupplierPoByRef(input.refNo)
  const result = await setSpoItemPricesCore(spo.id, input.prices)
  const parts = [
    result.updated.length > 0
      ? `Updated ${result.updated.length} price(s) on ${spo.refNo}: ${result.updated.map(u => `${u.productName} = ${formatCurrency(u.buyPrice)}`).join(", ")}.`
      : null,
    result.notFound.length > 0
      ? `Could not uniquely match these product names on that PO: ${result.notFound.join(", ")}.`
      : null,
  ].filter((l): l is string => l !== null)
  if (result.updated.length === 0) return { content: parts.join(" "), isError: true }
  return { content: parts.join(" "), mutated: true }
}

async function handleDeleteRequest(
  tool: PendingConfirmation["tool"],
  noun: string,
  resolve: (ref: string) => Promise<{ id: string; refNo: string }>,
  refNo: string,
): Promise<ToolExecutionResult> {
  const record = await resolve(refNo)
  return {
    content: `Ask the user to confirm: are they sure they want to DELETE ${noun} ${record.refNo}? This cannot be undone. They must reply with a clear "yes" in their next message for it to actually happen - do not delete it yourself.`,
    pendingConfirmation: { tool, id: record.id, refNo: record.refNo },
  }
}

/** Run one tool call. Never throws - UserErrors and unexpected errors both become an `isError` tool result. */
export async function executeTool(name: string, rawInput: unknown, ctx: AgentToolContext): Promise<ToolExecutionResult> {
  try {
    switch (name) {
      case "get_quotation": {
        const input = GetQuotationInput.parse(rawInput)
        const q = await resolveQuotationByRef(input.refNo)
        const full = await prisma.quotation.findUniqueOrThrow({
          where: { id: q.id },
          include: { customer: true, items: true, sections: { include: { items: true } } },
        })
        return { content: formatQuotation(full) }
      }
      case "list_quotations": {
        const input = ListQuotationsInput.parse(rawInput)
        if (input.status && !(QUOTATION_STATUSES as readonly string[]).includes(input.status)) {
          return { content: `"${input.status}" is not a valid status. Valid: ${STATUS_LIST(QUOTATION_STATUSES)}.`, isError: true }
        }
        const rows = await prisma.quotation.findMany({
          where: {
            status: input.status ?? undefined,
            customer: input.customerName ? { name: { contains: input.customerName, mode: "insensitive" } } : undefined,
          },
          orderBy: { date: "desc" },
          take: input.limit,
          include: { customer: true, items: true },
        })
        if (rows.length === 0) return { content: "No quotations match." }
        return {
          content: rows
            .map(q => `${q.refNo} - ${q.status} - ${q.customer?.name ?? "Manual Entry"} - ${formatDateForList(q.date)}`)
            .join("\n"),
        }
      }
      case "get_customer_po": {
        const input = GetCustomerPoInput.parse(rawInput)
        const cpo = await resolveCustomerPoByRef(input.refNo)
        const full = await prisma.customerPO.findUniqueOrThrow({
          where: { id: cpo.id },
          include: { customer: true, items: true, supplierPOs: { include: { items: true } } },
        })
        return { content: formatCustomerPo(full) }
      }
      case "list_customer_pos": {
        const input = ListCustomerPosInput.parse(rawInput)
        const rows = await prisma.customerPO.findMany({
          where: { status: input.status ?? undefined },
          orderBy: { date: "desc" },
          take: input.limit,
          include: { customer: true, items: true },
        })
        if (rows.length === 0) return { content: "No customer POs match." }
        return {
          content: rows
            .map(c => `${c.refNo} - ${c.status} - ${c.customer?.name ?? "Manual Entry"} - revenue ${formatCurrency(cpoFinance({ ...c, supplierPOs: [] }).revenue)}`)
            .join("\n"),
        }
      }
      case "get_supplier_po": {
        const input = GetSupplierPoInput.parse(rawInput)
        const spo = await resolveSupplierPoByRef(input.refNo)
        const full = await prisma.supplierPO.findUniqueOrThrow({
          where: { id: spo.id },
          include: { supplier: true, cpo: true, items: true },
        })
        return { content: formatSupplierPo(full) }
      }
      case "list_supplier_pos": {
        const input = ListSupplierPosInput.parse(rawInput)
        if (input.status && !(SPO_STATUSES as readonly string[]).includes(input.status)) {
          return { content: `"${input.status}" is not a valid status. Valid: ${STATUS_LIST(SPO_STATUSES)}.`, isError: true }
        }
        const rows = await prisma.supplierPO.findMany({
          where: { status: input.status ?? undefined },
          orderBy: { date: "desc" },
          take: input.limit,
          include: { supplier: true },
        })
        if (rows.length === 0) return { content: "No supplier POs match." }
        return { content: rows.map(s => `${s.refNo} - ${s.status} - ${s.supplier?.name ?? "Unassigned"}`).join("\n") }
      }
      case "get_customer_profile": {
        const input = GetCustomerProfileInput.parse(rawInput)
        const resolved = await resolveCustomerByName(input.name)
        if (!resolved) return { content: `No customer found matching "${input.name}".`, isError: true }
        if ("ambiguous" in resolved) {
          return { content: `Multiple customers match "${input.name}": ${resolved.ambiguous.join(", ")}. Be more specific.`, isError: true }
        }
        const [quotations, cpos] = await Promise.all([
          prisma.quotation.findMany({ where: { customerId: resolved.id }, select: { status: true } }),
          prisma.customerPO.findMany({ where: { customerId: resolved.id }, include: { items: true } }),
        ])
        const won = quotations.filter(q => q.status === "Won").length
        const lifetimeRevenue = cpos
          .filter(c => c.status === "Fulfilled")
          .reduce((s, c) => s + c.items.reduce((is, i) => is + i.qty * i.sellPrice, 0), 0)
        return {
          content: [
            `${resolved.name}${resolved.contactDetails ? ` - ${resolved.contactDetails}` : ""}`,
            `Quotations: ${quotations.length} (${won} won)`,
            `Customer POs: ${cpos.length}`,
            `Lifetime revenue (fulfilled orders): ${formatCurrency(lifetimeRevenue)}`,
          ].join("\n"),
        }
      }
      case "get_dashboard_summary": {
        const [cpos, totalCustomers, openQuotes, openCPOs, activeSPOs] = await Promise.all([
          prisma.customerPO.findMany({
            where: { status: { not: "Cancelled" } },
            include: { items: true, supplierPOs: { include: { items: true } } },
          }),
          prisma.customer.count(),
          prisma.quotation.count({ where: { status: { notIn: ["Won", "Lost", "Expired", "Cancelled", "Revised"] } } }),
          prisma.customerPO.count({ where: { status: "Open" } }),
          prisma.supplierPO.count({ where: { status: { notIn: ["Closed", "Draft"] } } }),
        ])
        const finances = cpos.map(cpoFinance)
        const revenue = finances.reduce((s, f) => s + f.revenue, 0)
        const withExpected = finances.filter(f => f.expectedProfit !== null)
        const withActual = finances.filter(f => f.actualProfit !== null)
        const expectedProfit = withExpected.reduce((s, f) => s + (f.expectedProfit ?? 0), 0)
        const actualProfit = withActual.reduce((s, f) => s + (f.actualProfit ?? 0), 0)
        return {
          content: [
            `Total customers: ${totalCustomers}`,
            `Open quotations: ${openQuotes}`,
            `Open customer POs: ${openCPOs}`,
            `Active supplier POs: ${activeSPOs}`,
            `Order revenue (active orders): ${formatCurrency(revenue)}`,
            `Expected profit: ${formatCurrency(expectedProfit)} (${withExpected.length}/${cpos.length} orders have cost estimates)`,
            `Actual profit: ${formatCurrency(actualProfit)} (${withActual.length}/${cpos.length} orders fully priced by suppliers)`,
          ].join("\n"),
        }
      }
      case "get_margins_summary": {
        const input = GetMarginsSummaryInput.parse(rawInput)
        const cpos = await prisma.customerPO.findMany({
          where: { status: { not: "Cancelled" } },
          include: { customer: true, items: true, supplierPOs: { include: { items: true } } },
        })
        const priced = cpos
          .map(c => ({ cpo: c, fin: cpoFinance(c) }))
          .filter(r => r.fin.hasActual)
          .sort((a, b) => (b.fin.actualMarginPct ?? 0) - (a.fin.actualMarginPct ?? 0))
        if (priced.length === 0) return { content: "No fully-priced orders yet to rank by margin." }
        const fmt = (r: (typeof priced)[number]) =>
          `${r.cpo.refNo} (${r.cpo.customer?.name ?? "Manual Entry"}): ${r.fin.actualMarginPct?.toFixed(1)}% margin, profit ${formatCurrency(r.fin.actualProfit!)}`
        const best = priced.slice(0, input.limit).map(fmt)
        const worst = priced.slice(-input.limit).reverse().map(fmt)
        return { content: `Best margins:\n${best.join("\n")}\n\nWorst margins:\n${worst.join("\n")}` }
      }

      case "create_quotation":
        return await handleCreateQuotation(CreateQuotationInput.parse(rawInput), ctx)
      case "update_quotation_status":
        return await handleUpdateQuotationStatus(UpdateQuotationStatusInput.parse(rawInput))
      case "update_supplier_po_status":
        return await handleUpdateSupplierPoStatus(UpdateSupplierPoStatusInput.parse(rawInput))
      case "set_supplier_po_prices":
        return await handleSetSupplierPoPrices(SetSupplierPoPricesInput.parse(rawInput))

      case "delete_quotation": {
        const input = DeleteQuotationInput.parse(rawInput)
        return await handleDeleteRequest("delete_quotation", "quotation", resolveQuotationByRef, input.refNo)
      }
      case "delete_customer_po": {
        const input = DeleteCustomerPoInput.parse(rawInput)
        return await handleDeleteRequest("delete_customer_po", "customer PO", resolveCustomerPoByRef, input.refNo)
      }
      case "delete_supplier_po": {
        const input = DeleteSupplierPoInput.parse(rawInput)
        return await handleDeleteRequest("delete_supplier_po", "supplier PO", resolveSupplierPoByRef, input.refNo)
      }

      default:
        return { content: `Unknown tool "${name}".`, isError: true }
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { content: `Invalid input: ${err.issues.map(i => i.message).join("; ")}`, isError: true }
    }
    if (err instanceof UserError) {
      return { content: err.message, isError: true }
    }
    console.error(`[whatsapp agent] tool "${name}" failed:`, err)
    return { content: toUserMessage(err), isError: true }
  }
}

function formatDateForList(d: Date): string {
  return d.toISOString().slice(0, 10)
}
