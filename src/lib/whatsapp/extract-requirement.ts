import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"

const ExtractedLineSchema = z.object({
  /** Cleaned-up description, as it should appear on the quotation line. */
  description: z.string().min(1),
  qty: z.number(),
  unit: z.string().nullable(),
  brand: z.string().nullable(),
  /**
   * The EXACT catalogKey of a confidently matching catalogue entry, copied
   * verbatim from the supplied list - or null if nothing matches well
   * enough. Never invented: a key that is not in the supplied list is
   * treated as no match (see matchExtractedLine).
   */
  catalogKey: z.string().nullable(),
})

const ExtractionSchema = z.object({
  /** The customer name/company as written by staff, if the message states one. */
  customerHint: z.string().nullable(),
  lines: z.array(ExtractedLineSchema).min(1),
})

export type ExtractedLine = z.infer<typeof ExtractedLineSchema>
export type Extraction = z.infer<typeof ExtractionSchema>

const SYSTEM_PROMPT = `You read a customer requirement that was forwarded to you on WhatsApp by staff at an \
IT/CCTV/networking trading company, and turn it into a structured list of items for a sales quotation.

The message may be messy: mixed languages, abbreviations, brand shorthand, quantities written as "2x" or \
"two" or "qty 5", multiple items per line, or no formatting at all. Do your best to split it into \
individual line items.

You are given the company's product/service catalogue below, each line formatted as:
  <catalogKey> => <description>, Rs.<rate> per <unit>

For each item you extract, if - and only if - it clearly matches one catalogue entry, copy that entry's \
catalogKey EXACTLY as written (same case, same punctuation, same "brand|name" shape). Do not invent a key, \
do not guess a close key, and do not modify a key. If you are not confident, set catalogKey to null - a \
human will price that line manually, which is far better than guessing wrong. When nothing in the \
catalogue matches, still extract the line (with catalogKey null) so nothing the customer asked for is lost.

If the message states who the customer/company is (e.g. starts with "Customer: X" or "For X Pvt Ltd" or \
similar), put that name in customerHint. Otherwise customerHint is null. Do not invent a customer name.`

export type ExtractorFn = (args: { message: string; catalogPromptBlock: string }) => Promise<Extraction>

/**
 * Default extractor: calls Claude with a structured-output schema so the
 * response is guaranteed to parse. Exported separately from
 * `extractRequirement` below so tests can inject a stub instead of making a
 * real API call.
 */
export async function callClaudeExtractor(args: { message: string; catalogPromptBlock: string }): Promise<Extraction> {
  const client = new Anthropic()

  const response = await client.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Catalogue:\n${args.catalogPromptBlock}\n\nCustomer requirement message:\n"""\n${args.message}\n"""`,
      },
    ],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  })

  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable requirement extraction.")
  }
  return response.parsed_output
}

/** Resolve a positive integer quantity from whatever the model extracted. */
export function normalizeQty(qty: number): number {
  const n = Math.round(qty)
  return Number.isFinite(n) && n > 0 ? n : 1
}
