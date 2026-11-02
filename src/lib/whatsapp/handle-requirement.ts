import { prisma } from "@/lib/prisma"
import { createQuotationCore } from "@/lib/quotation-create"
import type { ValidItem, ValidQuotation } from "@/lib/quotation-payload"
import { calcQuotationTotals, lineTotal } from "@/lib/totals"
import { formatCurrency } from "@/lib/utils"
import { loadWhatsAppCatalog, type CatalogEntry } from "./catalog"
import {
  callClaudeExtractor,
  normalizeQty,
  type Extraction,
  type ExtractedLine,
  type ExtractorFn,
} from "./extract-requirement"

export type MatchedLine = { entry: CatalogEntry; qty: number }
export type UnmatchedLine = { description: string; qty: number; unit: string | null; brand: string | null }
export type ResolvedCustomer = { id: string; name: string; contactDetails: string | null }

export type HandleResult = {
  quotationId: string | null
  refNo: string | null
  matched: MatchedLine[]
  unmatched: UnmatchedLine[]
  customer: ResolvedCustomer | null
  replyText: string
}

const DEFAULT_GST_PCT = 18
const REPLY_RAW_PREVIEW_CHARS = 300

/** Exact-key lookup only - see extract-requirement.ts for why the model never gets to fuzzy-match. */
export function matchLines(
  lines: ExtractedLine[],
  byKey: Map<string, CatalogEntry>,
): { matched: MatchedLine[]; unmatched: UnmatchedLine[] } {
  const matched: MatchedLine[] = []
  const unmatched: UnmatchedLine[] = []
  for (const line of lines) {
    const entry = line.catalogKey ? byKey.get(line.catalogKey) : undefined
    if (entry) {
      matched.push({ entry, qty: normalizeQty(line.qty) })
    } else {
      unmatched.push({
        description: line.description,
        qty: normalizeQty(line.qty),
        unit: line.unit,
        brand: line.brand,
      })
    }
  }
  return { matched, unmatched }
}

/**
 * Resolve a staff-written customer hint to exactly one existing Customer.
 * Ambiguous (multiple matches) or unknown names are left unresolved rather
 * than guessed - the quotation is still created, just unlinked, and the
 * WhatsApp reply says so.
 */
export async function resolveCustomer(hint: string | null): Promise<ResolvedCustomer | null> {
  const name = hint?.trim()
  if (!name) return null
  const matches = await prisma.customer.findMany({
    where: { name: { contains: name, mode: "insensitive" } },
    take: 2,
    select: { id: true, name: true, contactDetails: true },
  })
  return matches.length === 1 ? matches[0] : null
}

function toValidItem(m: MatchedLine): ValidItem {
  return {
    type: m.entry.type,
    brand: m.entry.brand,
    productName: m.entry.brand ? `${m.entry.brand} ${m.entry.name}` : m.entry.name,
    qty: m.qty,
    unit: m.entry.unit,
    sellPrice: m.entry.sellPrice,
    estimatedCost: m.entry.estimatedCost,
    laborCost: null,
    materialCost: null,
    transportCost: null,
    otherCost: null,
  }
}

function buildQuotationData(matched: MatchedLine[], customer: ResolvedCustomer | null): ValidQuotation {
  const allProduct = matched.every(m => m.entry.type === "PRODUCT")
  const allService = matched.every(m => m.entry.type === "SERVICE")

  return {
    customerId: customer?.id ?? null,
    customerAddress: customer ? customer.name + (customer.contactDetails ? `\n${customer.contactDetails}` : "") : null,
    refNo: null, // allocated by createQuotationCore
    date: new Date(),
    validUntil: null,
    salutation: "Dear Sir / Madam,",
    subject: null,
    type: allProduct ? "PRODUCT" : allService ? "SERVICE" : "MIXED",
    includeGst: true,
    gstPct: DEFAULT_GST_PCT,
    includeFreight: false,
    freightAmount: 0,
    terms: "[]",
    sections: [],
    items: matched.map(toValidItem),
  }
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  return t.length > max ? t.slice(0, max) + "…" : t
}

function buildReplyText(args: {
  rawMessage: string
  refNo: string | null
  matched: MatchedLine[]
  unmatched: UnmatchedLine[]
  customer: ResolvedCustomer | null
  customerHint: string | null
  appUrl: string
  quotationId: string | null
}): string {
  const { matched, unmatched } = args

  if (matched.length === 0) {
    return [
      `⚠️ Couldn't match anything in that message to the catalogue, so no quotation was created.`,
      ``,
      `You wrote:`,
      `"${truncate(args.rawMessage, REPLY_RAW_PREVIEW_CHARS)}"`,
      ``,
      `Add it as a new quotation manually, or add the missing items to the catalogue in Settings and resend.`,
    ].join("\n")
  }

  const totals = calcQuotationTotals({
    lines: matched.map(m => ({ qty: m.qty, price: m.entry.sellPrice, cost: m.entry.estimatedCost })),
    includeGst: true,
    gstPct: DEFAULT_GST_PCT,
    includeFreight: false,
    freightAmount: 0,
  })

  const lines: string[] = []
  lines.push(
    `✅ Quotation ${args.refNo} created${args.customer ? ` for ${args.customer.name}` : ""} (${matched.length} item${matched.length > 1 ? "s" : ""})`,
  )
  lines.push("")
  for (const m of matched) {
    const label = m.entry.brand ? `${m.entry.brand} ${m.entry.name}` : m.entry.name
    lines.push(`- ${label} x${m.qty} — ${formatCurrency(lineTotal(m.qty, m.entry.sellPrice))}`)
  }
  lines.push("")
  lines.push(`Subtotal: ${formatCurrency(totals.subtotal)}`)
  lines.push(`GST (${DEFAULT_GST_PCT}%): ${formatCurrency(totals.gstAmount)}`)
  lines.push(`Grand Total: ${formatCurrency(totals.grandTotal)}`)

  if (args.customerHint && !args.customer) {
    lines.push("")
    lines.push(`ℹ️ Couldn't match customer "${args.customerHint}" to exactly one existing contact - quotation left unlinked.`)
  }

  if (unmatched.length > 0) {
    lines.push("")
    lines.push(`⚠️ Not included (${unmatched.length}) - not in the catalogue, add manually:`)
    for (const u of unmatched) {
      lines.push(`- ${truncate(u.description, 80)}${u.qty > 1 ? ` x${u.qty}` : ""}`)
    }
  }

  if (args.appUrl) {
    lines.push("")
    lines.push(`Review & send: ${args.appUrl}/quotations/${args.quotationId}`)
  }

  return lines.join("\n")
}

async function logResult(args: {
  fromPhone: string
  rawMessage: string
  status: "PARSED" | "QUOTATION_CREATED" | "FAILED"
  customerHint: string | null
  customerId: string | null
  quotationId: string | null
  matchedCount: number
  unmatched: UnmatchedLine[]
  errorMessage?: string
}): Promise<void> {
  await prisma.botRequirementLog.create({
    data: {
      fromPhone: args.fromPhone,
      rawMessage: args.rawMessage,
      status: args.status,
      customerHint: args.customerHint,
      matchedCustomerId: args.customerId,
      quotationId: args.quotationId,
      matchedCount: args.matchedCount,
      unmatchedItems: args.unmatched.length > 0 ? JSON.stringify(args.unmatched) : null,
      errorMessage: args.errorMessage,
    },
  })
}

/**
 * The whole "paste a requirement, get a quotation" pipeline: load the
 * catalogue, extract structured lines from the free text, match them
 * exactly (no guessed prices), resolve the customer, create the quotation,
 * and build the WhatsApp reply - all of it logged either way so there is an
 * audit trail even though nothing here waits for a human to review it first.
 */
export async function handleWhatsAppRequirement(args: {
  fromPhone: string
  rawMessage: string
  extractor?: ExtractorFn
  appUrl?: string
}): Promise<HandleResult> {
  const extractor = args.extractor ?? callClaudeExtractor
  const appUrl = (args.appUrl ?? process.env.APP_URL ?? "").replace(/\/$/, "")

  const { byKey, promptBlock } = await loadWhatsAppCatalog()

  let extraction: Extraction
  try {
    extraction = await extractor({ message: args.rawMessage, catalogPromptBlock: promptBlock })
  } catch (err) {
    await logResult({
      fromPhone: args.fromPhone,
      rawMessage: args.rawMessage,
      status: "FAILED",
      customerHint: null,
      customerId: null,
      quotationId: null,
      matchedCount: 0,
      unmatched: [],
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }

  const { matched, unmatched } = matchLines(extraction.lines, byKey)
  const customer = await resolveCustomer(extraction.customerHint)

  if (matched.length === 0) {
    const replyText = buildReplyText({
      rawMessage: args.rawMessage,
      refNo: null,
      matched,
      unmatched,
      customer,
      customerHint: extraction.customerHint,
      appUrl,
      quotationId: null,
    })
    await logResult({
      fromPhone: args.fromPhone,
      rawMessage: args.rawMessage,
      status: "PARSED",
      customerHint: extraction.customerHint,
      customerId: customer?.id ?? null,
      quotationId: null,
      matchedCount: 0,
      unmatched,
    })
    return { quotationId: null, refNo: null, matched, unmatched, customer, replyText }
  }

  const created = await createQuotationCore(buildQuotationData(matched, customer))

  const replyText = buildReplyText({
    rawMessage: args.rawMessage,
    refNo: created.refNo,
    matched,
    unmatched,
    customer,
    customerHint: extraction.customerHint,
    appUrl,
    quotationId: created.id,
  })

  await logResult({
    fromPhone: args.fromPhone,
    rawMessage: args.rawMessage,
    status: "QUOTATION_CREATED",
    customerHint: extraction.customerHint,
    customerId: customer?.id ?? null,
    quotationId: created.id,
    matchedCount: matched.length,
    unmatched,
  })

  return { quotationId: created.id, refNo: created.refNo, matched, unmatched, customer, replyText }
}
