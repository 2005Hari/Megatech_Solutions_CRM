import type { ItemType, Prisma, QuotationType } from "@prisma/client"
import { UserError } from "./errors"
import {
  dateFrom,
  money,
  oneOf,
  optionalDate,
  optionalMoney,
  optionalString,
  percent,
  positiveInt,
  requiredString,
} from "./validation"

/** What the quotation builder sends to the server. Never trusted as-is. */

export type QuotationItemPayload = {
  type: ItemType
  brand?: string
  productName: string
  qty: number
  unit?: string
  sellPrice: number
  estimatedCost?: number
  laborCost?: number
  materialCost?: number
  transportCost?: number
  otherCost?: number
}

export type QuotationSectionPayload = {
  name: string
  items: QuotationItemPayload[]
}

export type QuotationPayload = {
  customerId?: string
  customerAddress?: string
  /** Leave out to have the server allocate the next number. */
  refNo?: string
  date: string
  validUntil?: string
  salutation: string
  subject: string
  type: QuotationType
  includeGst: boolean
  gstPct: number
  includeFreight: boolean
  freightAmount: number
  terms: string
  sections: QuotationSectionPayload[]
  /** Items that are not inside any section. */
  items: QuotationItemPayload[]
}

export type ValidItem = {
  type: ItemType
  brand: string | null
  productName: string
  qty: number
  unit: string
  sellPrice: number
  estimatedCost: number | null
  laborCost: number | null
  materialCost: number | null
  transportCost: number | null
  otherCost: number | null
}

export type ValidQuotation = {
  customerId: string | null
  customerAddress: string | null
  refNo: string | null
  date: Date
  validUntil: Date | null
  salutation: string | null
  subject: string | null
  type: QuotationType
  includeGst: boolean
  gstPct: number
  includeFreight: boolean
  freightAmount: number
  terms: string
  sections: { name: string; order: number; items: ValidItem[] }[]
  items: ValidItem[]
}

const ITEM_TYPES = ["PRODUCT", "SERVICE"] as const
const QUOTATION_TYPES = ["PRODUCT", "SERVICE", "MIXED"] as const
const MAX_LINES = 500

function parseItem(raw: QuotationItemPayload, where: string): ValidItem {
  if (!raw || typeof raw !== "object") throw new UserError(`${where}: invalid line item.`)
  return {
    type: oneOf(raw.type, ITEM_TYPES, `${where}: item type`),
    brand: optionalString(raw.brand, `${where}: brand`, 200),
    productName: requiredString(raw.productName, `${where}: description`, 2000),
    qty: positiveInt(raw.qty, `${where}: quantity`),
    unit: optionalString(raw.unit, `${where}: unit`, 50) ?? "Nos",
    sellPrice: money(raw.sellPrice, `${where}: rate`),
    estimatedCost: optionalMoney(raw.estimatedCost, `${where}: estimated cost`),
    laborCost: optionalMoney(raw.laborCost, `${where}: labour cost`),
    materialCost: optionalMoney(raw.materialCost, `${where}: material cost`),
    transportCost: optionalMoney(raw.transportCost, `${where}: transport cost`),
    otherCost: optionalMoney(raw.otherCost, `${where}: other cost`),
  }
}

function validateTerms(terms: unknown): string {
  if (typeof terms !== "string") throw new UserError("Terms are invalid.")
  if (terms.length > 20_000) throw new UserError("Terms are too long.")
  if (!terms) return "[]"
  let parsed: unknown
  try {
    parsed = JSON.parse(terms)
  } catch {
    throw new UserError("Terms are invalid.")
  }
  if (!Array.isArray(parsed) || parsed.some(t => !t || typeof t.label !== "string" || typeof t.value !== "string")) {
    throw new UserError("Terms are invalid.")
  }
  return terms
}

export function parseQuotationPayload(raw: QuotationPayload): ValidQuotation {
  if (!raw || typeof raw !== "object") throw new UserError("Invalid quotation.")
  if (!Array.isArray(raw.items) || !Array.isArray(raw.sections)) throw new UserError("Invalid quotation lines.")
  if (raw.sections.length > 100) throw new UserError("Too many sections.")

  const date = dateFrom(raw.date, "Date")
  const validUntil = optionalDate(raw.validUntil, "Valid until")
  if (validUntil && validUntil < date) throw new UserError("'Valid until' cannot be before the quotation date.")

  const sections = raw.sections.map((s, i) => {
    if (!s || !Array.isArray(s.items)) throw new UserError(`Section ${i + 1} is invalid.`)
    return {
      name: requiredString(s.name, `Section ${i + 1} name`, 200),
      order: i,
      items: s.items.map((it, j) => parseItem(it, `Section "${s.name}" line ${j + 1}`)),
    }
  })
  const items = raw.items.map((it, j) => parseItem(it, `Line ${j + 1}`))

  const lineCount = items.length + sections.reduce((n, s) => n + s.items.length, 0)
  if (lineCount === 0) throw new UserError("Add at least one line item with a description.")
  if (lineCount > MAX_LINES) throw new UserError(`A quotation can have at most ${MAX_LINES} line items.`)

  const refNo = optionalString(raw.refNo, "Quotation number", 100)

  return {
    customerId: optionalString(raw.customerId, "Customer", 100),
    customerAddress: optionalString(raw.customerAddress, "Customer address", 2000),
    refNo,
    date,
    validUntil,
    salutation: optionalString(raw.salutation, "Salutation", 200),
    subject: optionalString(raw.subject, "Subject", 500),
    type: oneOf(raw.type, QUOTATION_TYPES, "Quotation type") as QuotationType,
    includeGst: Boolean(raw.includeGst),
    gstPct: percent(raw.gstPct, "GST %"),
    includeFreight: Boolean(raw.includeFreight),
    freightAmount: money(raw.freightAmount, "Freight"),
    terms: validateTerms(raw.terms),
    sections,
    items,
  }
}

export function itemCreateData(i: ValidItem, order: number, quotationId: string): Prisma.QuotationItemUncheckedCreateWithoutSectionInput {
  return {
    quotationId,
    type: i.type,
    order,
    brand: i.brand,
    productName: i.productName,
    qty: i.qty,
    unit: i.unit,
    sellPrice: i.sellPrice,
    estimatedCost: i.estimatedCost,
    laborCost: i.laborCost,
    materialCost: i.materialCost,
    transportCost: i.transportCost,
    otherCost: i.otherCost,
  }
}

/**
 * Write the sections and loose items of a quotation. The three actions that
 * used to each carry their own copy of this mapping now share it.
 */
export async function writeQuotationBody(
  tx: Prisma.TransactionClient,
  quotationId: string,
  body: { sections: { name: string; order: number; items: ValidItem[] }[]; items: ValidItem[] },
): Promise<void> {
  for (const sec of body.sections) {
    await tx.quotationSection.create({
      data: {
        quotationId,
        name: sec.name,
        order: sec.order,
        items: { create: sec.items.map((it, idx) => itemCreateData(it, idx, quotationId)) },
      },
    })
  }
  if (body.items.length > 0) {
    await tx.quotationItem.createMany({
      data: body.items.map((it, idx) => itemCreateData(it, idx, quotationId)),
    })
  }
}
