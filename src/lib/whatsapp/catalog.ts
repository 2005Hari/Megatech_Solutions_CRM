import { prisma } from "@/lib/prisma"
import { catalogKey } from "@/lib/catalog-key"
import type { ItemType } from "@prisma/client"

/** One catalogue entry (product or service), normalized for matching/pricing. */
export type CatalogEntry = {
  key: string
  type: ItemType
  brand: string | null
  name: string
  unit: string
  sellPrice: number
  estimatedCost: number | null
  promptLine: string
}

const MAX_CATALOG_ITEMS = 400

/**
 * Load the active catalogue for the WhatsApp bot: a map keyed by
 * `catalogKey` (for exact-match lookup after extraction) plus a flat prompt
 * block (for the extraction model to read and copy keys from verbatim).
 *
 * v1 limitation: the whole catalogue is sent in the prompt every time, so
 * this does not scale past a few hundred items without a retrieval step
 * (e.g. embedding search to shortlist candidates first).
 */
export async function loadWhatsAppCatalog(): Promise<{ byKey: Map<string, CatalogEntry>; promptBlock: string }> {
  const [products, services] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, take: MAX_CATALOG_ITEMS, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { active: true }, take: MAX_CATALOG_ITEMS, orderBy: { name: "asc" } }),
  ])

  const byKey = new Map<string, CatalogEntry>()
  const lines: string[] = []

  for (const p of products) {
    const entry: CatalogEntry = {
      key: p.catalogKey,
      type: "PRODUCT",
      brand: p.brand,
      name: p.name,
      unit: p.defaultUnit,
      sellPrice: p.defaultRate,
      estimatedCost: p.defaultCost,
      promptLine: `${p.catalogKey} => ${p.brand ? p.brand + " " : ""}${p.name}, Rs.${p.defaultRate} per ${p.defaultUnit}`,
    }
    byKey.set(p.catalogKey, entry)
    lines.push(entry.promptLine)
  }

  for (const s of services) {
    const key = catalogKey(null, s.name)
    const entry: CatalogEntry = {
      key,
      type: "SERVICE",
      brand: null,
      name: s.name,
      unit: s.defaultUnit,
      sellPrice: s.defaultRate,
      estimatedCost: null,
      promptLine: `${key} => ${s.name} (service), Rs.${s.defaultRate} per ${s.defaultUnit}`,
    }
    // A product and a service could coincidentally share a key; products win
    // since they were inserted first and this is just an informational list.
    if (!byKey.has(key)) byKey.set(key, entry)
    lines.push(entry.promptLine)
  }

  return { byKey, promptBlock: lines.join("\n") }
}
