import Anthropic from "@anthropic-ai/sdk"
import { AGENT_TOOLS, executeTool, type AgentToolContext, type PendingConfirmation } from "./agent-tools"

/**
 * The agentic loop. A manual loop rather than the SDK's beta Tool Runner:
 * conversation state has to survive across separate webhook invocations (one
 * per incoming WhatsApp message), so the exact message array - including
 * every tool_use/tool_result block - needs to be captured and persisted by
 * this code, not left inside a runner object. See the Claude API skill's
 * tool-use guide, "Manual Agentic Loop".
 */

export type ToolCallRecord = { name: string; input: unknown; resultSummary: string; isError: boolean }

export type AgentTurnResult = {
  /** Full updated message history - append this to what was stored and persist it as-is. */
  messages: Anthropic.Beta.BetaMessageParam[]
  replyText: string
  toolCalls: ToolCallRecord[]
  /** Set if a delete_* tool was invoked this turn - see handle-message.ts. */
  pendingConfirmation: PendingConfirmation | null
}

const MAX_ITERATIONS = 8
const MAX_TOOL_RESULT_CHARS = 4000

export type CreateMessageFn = (
  params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming,
) => Promise<Anthropic.Beta.BetaMessage>

/** Default: the real Anthropic API. Tests inject a stub instead - see agent.ts callers in tests/. */
function defaultCreateMessage(): CreateMessageFn {
  const client = new Anthropic()
  return params => client.beta.messages.create(params)
}

function buildSystemPrompt(catalogPromptBlock: string): string {
  const today = new Date().toISOString().slice(0, 10)
  return `You are the assistant built into Megatech Solutions' order-management system, reachable here on \
WhatsApp by staff only (never customers directly). Today's date is ${today}.

You can look up quotations, customer POs, supplier POs and customers, summarize the business (revenue, \
profit, margins), create a new Draft quotation from a list of items, move a quotation or supplier PO to a \
new status, and set buy prices on a supplier PO. Use your tools for anything factual - never state a \
figure, status or reference number from memory or a guess.

Creating a quotation: match each item to the catalogue below by its EXACT catalogKey, copied verbatim. If \
you are not confident an item matches, leave catalogKey null rather than guessing - a wrong match would \
price something incorrectly, which is worse than leaving it for a human to add manually. Say plainly which \
items were not matched.

Deleting something: delete_quotation / delete_customer_po / delete_supplier_po never delete immediately - \
they ask the user to confirm. Only call one of them when the user has clearly asked to delete that specific \
record. After calling one, just relay the confirmation question in your own words and stop; do not call it \
again in the same turn.

Keep replies short and in plain text - this is a WhatsApp chat, not a document. Use your own judgement on \
tone, but always be precise about numbers, statuses and reference numbers. If a tool result includes a \
"Review/send:" link, include that exact link in your reply, unchanged.

Product/service catalogue (format: catalogKey => description, Rs.rate per unit):
${catalogPromptBlock}`
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text
}

/** Run one turn: send the conversation (+ new user message) to Claude, executing tools until it stops. */
export async function runAgentTurn(args: {
  priorMessages: Anthropic.Beta.BetaMessageParam[]
  userMessage: string
  catalogPromptBlock: string
  toolContext: AgentToolContext
  createMessage?: CreateMessageFn
}): Promise<AgentTurnResult> {
  const createMessage = args.createMessage ?? defaultCreateMessage()
  const messages: Anthropic.Beta.BetaMessageParam[] = [...args.priorMessages, { role: "user", content: args.userMessage }]
  const toolCalls: ToolCallRecord[] = []
  let pendingConfirmation: PendingConfirmation | null = null

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await createMessage({
      model: "claude-opus-5-5",
      max_tokens: 4096,
      system: buildSystemPrompt(args.catalogPromptBlock),
      tools: AGENT_TOOLS,
      messages,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    })

    messages.push({ role: "assistant", content: response.content })

    if (response.stop_reason === "refusal") {
      return {
        messages,
        replyText: "Sorry, I can't help with that request.",
        toolCalls,
        pendingConfirmation,
      }
    }

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    )

    if (toolUseBlocks.length === 0) {
      const text = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map(b => b.text)
        .join("\n")
        .trim()
      return {
        messages,
        replyText: text || "Done.",
        toolCalls,
        pendingConfirmation,
      }
    }

    const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const block of toolUseBlocks) {
      const result = await executeTool(block.name, block.input, args.toolContext)
      if (result.pendingConfirmation) pendingConfirmation = result.pendingConfirmation
      toolCalls.push({ name: block.name, input: block.input, resultSummary: truncate(result.content, 300), isError: Boolean(result.isError) })
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: truncate(result.content, MAX_TOOL_RESULT_CHARS),
        is_error: result.isError,
      })
    }
    messages.push({ role: "user", content: toolResults })
  }

  // Hit the iteration cap - stop rather than loop forever (and keep cost bounded).
  return {
    messages,
    replyText: "That took more steps than I'm allowed in one go - could you break it into smaller requests?",
    toolCalls,
    pendingConfirmation,
  }
}
