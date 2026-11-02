import { prisma } from "@/lib/prisma"
import { UserError } from "@/lib/errors"
import { deleteCpoCore, deleteQuotationCore, deleteSpoCore } from "@/lib/delete-cores"
import { loadWhatsAppCatalog } from "./catalog"
import { runAgentTurn, type CreateMessageFn, type ToolCallRecord } from "./agent"
import type { PendingConfirmation } from "./agent-tools"
import { classifyConfirmationReply, clearPendingConfirmation, loadConversation, saveConversation } from "./conversation"

export type HandleMessageResult = { replyText: string }

async function logAction(args: {
  fromPhone: string
  userMessage: string
  status: "OK" | "FAILED"
  toolCalls: ToolCallRecord[] | null
  replyText: string | null
  errorMessage?: string
}): Promise<void> {
  await prisma.botActionLog.create({
    data: {
      fromPhone: args.fromPhone,
      userMessage: args.userMessage,
      status: args.status,
      toolCalls: args.toolCalls && args.toolCalls.length > 0 ? JSON.stringify(args.toolCalls) : null,
      replyText: args.replyText,
      errorMessage: args.errorMessage,
    },
  })
}

/**
 * Execute a previously-confirmed delete directly against the same core the
 * app UI uses - NOT by asking Claude to re-issue the tool call. The model
 * only ever gets to ask the question; the deletion itself is deterministic
 * code running on the id captured when the question was first asked.
 */
async function executeConfirmedDelete(pending: PendingConfirmation): Promise<{ replyText: string; ok: boolean }> {
  try {
    switch (pending.tool) {
      case "delete_quotation":
        await deleteQuotationCore(pending.id)
        return { replyText: `Deleted quotation ${pending.refNo}.`, ok: true }
      case "delete_customer_po":
        await deleteCpoCore(pending.id)
        return { replyText: `Deleted customer PO ${pending.refNo}.`, ok: true }
      case "delete_supplier_po":
        await deleteSpoCore(pending.id)
        return { replyText: `Deleted supplier PO ${pending.refNo}.`, ok: true }
      default:
        return { replyText: "Nothing was pending to confirm.", ok: false }
    }
  } catch (err) {
    if (err instanceof UserError) {
      return { replyText: `Could not delete ${pending.refNo}: ${err.message}`, ok: false }
    }
    console.error("[whatsapp agent] confirmed delete failed:", err)
    return { replyText: `Something went wrong deleting ${pending.refNo}. Please try from the app.`, ok: false }
  }
}

/**
 * Handle one inbound WhatsApp message from an ALREADY-ALLOWLISTED sender
 * (the webhook checks that before calling this). Two paths:
 *
 *  1. There is a live pending confirmation (a delete_* tool was called last
 *     turn) - this message is read as yes/no/other to THAT question, never
 *     as a new request, and the delete (if confirmed) runs directly, not
 *     through the model.
 *  2. Otherwise, run the normal tool-using agent turn.
 */
export async function handleWhatsAppMessage(args: {
  fromPhone: string
  text: string
  appUrl?: string
  createMessage?: CreateMessageFn
}): Promise<HandleMessageResult> {
  const conversation = await loadConversation(args.fromPhone)

  if (conversation.pendingConfirmation) {
    const verdict = classifyConfirmationReply(args.text)

    if (verdict === "yes") {
      const { replyText, ok } = await executeConfirmedDelete(conversation.pendingConfirmation)
      await clearPendingConfirmation(args.fromPhone)
      await logAction({ fromPhone: args.fromPhone, userMessage: args.text, status: ok ? "OK" : "FAILED", toolCalls: null, replyText })
      return { replyText }
    }

    if (verdict === "no") {
      await clearPendingConfirmation(args.fromPhone)
      const replyText = `Cancelled - ${conversation.pendingConfirmation.refNo} was not deleted.`
      await logAction({ fromPhone: args.fromPhone, userMessage: args.text, status: "OK", toolCalls: null, replyText })
      return { replyText }
    }

    // Ambiguous reply: treat the pending confirmation as abandoned (never
    // auto-confirm on an unclear message) and handle this as a new message.
    await clearPendingConfirmation(args.fromPhone)
  }

  const { byKey, promptBlock } = await loadWhatsAppCatalog()
  const appUrl = (args.appUrl ?? process.env.APP_URL ?? "").replace(/\/$/, "")

  let turn
  try {
    turn = await runAgentTurn({
      priorMessages: conversation.messages,
      userMessage: args.text,
      catalogPromptBlock: promptBlock,
      toolContext: { catalogByKey: byKey, appUrl },
      createMessage: args.createMessage,
    })
  } catch (err) {
    await logAction({
      fromPhone: args.fromPhone,
      userMessage: args.text,
      status: "FAILED",
      toolCalls: null,
      replyText: null,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }

  await saveConversation({ phoneNumber: args.fromPhone, messages: turn.messages, pendingConfirmation: turn.pendingConfirmation })

  const hadError = turn.toolCalls.some(t => t.isError)
  await logAction({
    fromPhone: args.fromPhone,
    userMessage: args.text,
    status: hadError ? "FAILED" : "OK",
    toolCalls: turn.toolCalls,
    replyText: turn.replyText,
  })

  return { replyText: turn.replyText }
}
