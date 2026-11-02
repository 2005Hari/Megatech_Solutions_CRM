import type Anthropic from "@anthropic-ai/sdk"
import { prisma } from "@/lib/prisma"
import type { PendingConfirmation } from "./agent-tools"

const STALE_MS = 3 * 60 * 60 * 1000 // conversation resets after 3h of inactivity
const PENDING_CONFIRMATION_TTL_MS = 5 * 60 * 1000
const MAX_TURNS = 12 // trimmed on save, see trimToRecentTurns

export type LoadedConversation = {
  messages: Anthropic.Beta.BetaMessageParam[]
  pendingConfirmation: PendingConfirmation | null
}

function isPlainUserTurn(m: Anthropic.Beta.BetaMessageParam): boolean {
  return m.role === "user" && typeof m.content === "string"
}

/**
 * Keep only the most recent `maxTurns` user-initiated turns (and everything
 * between them: assistant replies, tool_use/tool_result round trips). Never
 * trims in the middle of a turn - cutting between a tool_use and its
 * tool_result would make the stored history invalid to replay.
 */
export function trimToRecentTurns(
  messages: Anthropic.Beta.BetaMessageParam[],
  maxTurns: number = MAX_TURNS,
): Anthropic.Beta.BetaMessageParam[] {
  let boundaries = 0
  let cutAt = 0
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isPlainUserTurn(messages[i])) {
      boundaries++
      if (boundaries === maxTurns) cutAt = i
      if (boundaries > maxTurns) return messages.slice(cutAt)
    }
  }
  return messages
}

export async function loadConversation(phoneNumber: string): Promise<LoadedConversation> {
  const row = await prisma.botConversation.findUnique({ where: { phoneNumber } })
  if (!row) return { messages: [], pendingConfirmation: null }

  const stale = Date.now() - row.updatedAt.getTime() > STALE_MS
  if (stale) return { messages: [], pendingConfirmation: null }

  let messages: Anthropic.Beta.BetaMessageParam[] = []
  try {
    const parsed = JSON.parse(row.messages)
    if (Array.isArray(parsed)) messages = parsed
  } catch {
    messages = []
  }

  const pendingLive = row.pendingConfirmation && row.pendingExpiresAt && row.pendingExpiresAt.getTime() > Date.now()
  let pendingConfirmation: PendingConfirmation | null = null
  if (pendingLive) {
    try {
      pendingConfirmation = JSON.parse(row.pendingConfirmation!) as PendingConfirmation
    } catch {
      pendingConfirmation = null
    }
  }

  return { messages, pendingConfirmation }
}

export async function saveConversation(args: {
  phoneNumber: string
  messages: Anthropic.Beta.BetaMessageParam[]
  pendingConfirmation: PendingConfirmation | null
}): Promise<void> {
  const trimmed = trimToRecentTurns(args.messages)
  const data = {
    messages: JSON.stringify(trimmed),
    pendingConfirmation: args.pendingConfirmation ? JSON.stringify(args.pendingConfirmation) : null,
    pendingExpiresAt: args.pendingConfirmation ? new Date(Date.now() + PENDING_CONFIRMATION_TTL_MS) : null,
  }
  await prisma.botConversation.upsert({
    where: { phoneNumber: args.phoneNumber },
    create: { phoneNumber: args.phoneNumber, ...data },
    update: data,
  })
}

export async function clearPendingConfirmation(phoneNumber: string): Promise<void> {
  await prisma.botConversation.updateMany({
    where: { phoneNumber },
    data: { pendingConfirmation: null, pendingExpiresAt: null },
  })
}

const AFFIRM = /^(yes|y|yeah|yep|yup|confirm(ed)?|correct|ok(ay)?|go ahead|do it|sure)\b/i
const DENY = /^(no|n|nope|nah|cancel|stop|don'?t|never ?mind|nvm)\b/i

/** Classify a reply to a pending "are you sure?" prompt. Deliberately simple and non-LLM: this gate must be predictable. */
export function classifyConfirmationReply(text: string): "yes" | "no" | "other" {
  const t = text.trim()
  if (AFFIRM.test(t)) return "yes"
  if (DENY.test(t)) return "no"
  return "other"
}
