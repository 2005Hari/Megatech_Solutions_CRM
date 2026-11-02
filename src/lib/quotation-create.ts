import { prisma } from "@/lib/prisma"
import { UserError } from "@/lib/errors"
import { nextQuotationRef } from "@/lib/refs"
import { writeQuotationBody, type ValidQuotation } from "@/lib/quotation-payload"

/**
 * Create a quotation from already-validated data.
 *
 * Deliberately NOT in a "use server" file: every export of those files is a
 * publicly callable endpoint reachable by direct POST (see the Next.js
 * data-security guide), so this is called from two trusted entry points
 * instead - the `createQuotation` server action (after `requireAuth()` and
 * `parseQuotationPayload`) and the WhatsApp bot webhook (after verifying the
 * request's signature and that the sender is allowlisted) - never directly
 * from the client.
 */
export async function createQuotationCore(data: ValidQuotation): Promise<{ id: string; refNo: string }> {
  return prisma.$transaction(async tx => {
    const refNo = data.refNo ?? (await nextQuotationRef(tx))
    if (data.refNo && (await tx.quotation.count({ where: { refNo } })) > 0) {
      throw new UserError(`Quotation number ${refNo} is already in use.`)
    }

    const quotation = await tx.quotation.create({
      data: {
        refNo,
        customerId: data.customerId,
        customerAddress: data.customerAddress,
        date: data.date,
        validUntil: data.validUntil,
        status: "Draft",
        salutation: data.salutation,
        subject: data.subject,
        type: data.type,
        includeGst: data.includeGst,
        gstPct: data.gstPct,
        includeFreight: data.includeFreight,
        freightAmount: data.freightAmount,
        terms: data.terms,
      },
    })
    await writeQuotationBody(tx, quotation.id, data)
    return { id: quotation.id, refNo: quotation.refNo }
  })
}
