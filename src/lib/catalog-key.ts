/**
 * Deterministic, human-readable key for a catalogue product (e.g.
 * "cp plus|2mp dome camera (cp-unc-da21l3)").
 *
 * Used in two places that must agree: Product.catalogKey in the database,
 * and the key the WhatsApp bot's extraction prompt asks Claude to return for
 * a matched line. Keeping the same function in both spots means a match is
 * always a plain string lookup - no fuzzy logic that could silently pick the
 * wrong product.
 */
export function catalogKey(brand: string | null | undefined, name: string): string {
  const b = (brand ?? "").trim().toLowerCase()
  const n = name.trim().toLowerCase()
  return b ? `${b}|${n}` : n
}
