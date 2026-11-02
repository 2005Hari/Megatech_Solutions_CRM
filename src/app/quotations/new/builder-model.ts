import type { ItemType, Service } from "@prisma/client"
import type { QuotationItemPayload, QuotationPayload } from "@/lib/quotation-payload"
import type { ProductOption } from "@/lib/catalog"
import type { QuotationWithRelations, Term } from "@/components/quotation/types"
import type { DocItem, DocSection } from "@/components/quotation/types"

export type CustomerOption = { id: string; name: string; contactDetails: string | null }
export type UnitOption = { id: string; name: string }
export type ServiceOption = Pick<Service, "id" | "name" | "description" | "defaultUnit" | "defaultRate">
export type { ProductOption }

/** Editable line in the builder. `rate` is the selling price per unit. */
export type BuilderItem = {
  id: string
  type: ItemType
  brand: string
  desc: string
  qty: number
  unit: string
  rate: number
  estCost: number
}

export type BuilderSection = { id: string; name: string; items: BuilderItem[] }

let seq = 0
/** Client-only row key. Called from event handlers, never during render. */
export function newRowId(): string {
  seq += 1
  return `row-${Date.now().toString(36)}-${seq}`
}

export function newItem(type: ItemType = "PRODUCT"): BuilderItem {
  return { id: newRowId(), type, brand: "", desc: "", qty: 1, unit: "Nos", rate: 0, estCost: 0 }
}

type SavedItem = QuotationWithRelations["items"][number]

export function toBuilderItem(i: SavedItem): BuilderItem {
  return {
    id: i.id,
    type: i.type,
    brand: i.brand ?? "",
    desc: i.productName,
    qty: i.qty,
    unit: i.unit ?? "Nos",
    rate: i.sellPrice,
    estCost: i.estimatedCost ?? 0,
  }
}

export function toDocItem(i: BuilderItem): DocItem {
  return { id: i.id, brand: i.brand, desc: i.desc, qty: i.qty, unit: i.unit, rate: i.rate }
}

export function toDocSection(s: BuilderSection): DocSection {
  return { id: s.id, name: s.name, items: s.items.map(toDocItem) }
}

function toPayloadItem(i: BuilderItem): QuotationItemPayload {
  return {
    type: i.type,
    brand: i.brand,
    productName: i.desc,
    qty: i.qty,
    unit: i.unit,
    sellPrice: i.rate,
    estimatedCost: i.estCost || undefined,
  }
}

export type BuilderFormState = {
  customerId: string
  customerAddress: string
  /** undefined = let the server allocate the next number */
  refNo: string | undefined
  date: string
  validUntil: string
  salutation: string
  subject: string
  type: QuotationPayload["type"]
  gstOn: boolean
  gstPct: number
  frOn: boolean
  freight: number
  terms: Term[]
  sections: BuilderSection[]
  items: BuilderItem[]
}

/** Lines the user left without a description are dropped (blank rows). */
export function buildPayload(f: BuilderFormState): QuotationPayload {
  const keep = (i: BuilderItem) => i.desc.trim().length > 0
  return {
    customerId: f.customerId || undefined,
    customerAddress: f.customerAddress,
    refNo: f.refNo,
    date: f.date,
    validUntil: f.validUntil || undefined,
    salutation: f.salutation,
    subject: f.subject,
    type: f.type,
    includeGst: f.gstOn,
    gstPct: f.gstPct,
    includeFreight: f.frOn,
    freightAmount: f.freight,
    terms: JSON.stringify(f.terms.filter(t => t.label.trim() || t.value.trim())),
    sections: f.sections.map(s => ({ name: s.name, items: s.items.filter(keep).map(toPayloadItem) })),
    items: f.items.filter(keep).map(toPayloadItem),
  }
}
