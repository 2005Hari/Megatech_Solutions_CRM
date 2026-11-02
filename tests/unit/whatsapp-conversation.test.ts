import { describe, expect, it } from "vitest"
import { classifyConfirmationReply, trimToRecentTurns } from "@/lib/whatsapp/conversation"
import type Anthropic from "@anthropic-ai/sdk"

describe("classifyConfirmationReply", () => {
  it("recognises common affirmatives", () => {
    for (const t of ["yes", "Yes", "YES", "yep", "y", "confirm", "confirmed", "ok", "okay", "go ahead", "do it", "sure"]) {
      expect(classifyConfirmationReply(t)).toBe("yes")
    }
  })

  it("recognises common denials", () => {
    for (const t of ["no", "No", "nope", "cancel", "stop", "don't", "nevermind", "nvm"]) {
      expect(classifyConfirmationReply(t)).toBe("no")
    }
  })

  it("never auto-confirms an unclear or unrelated reply - the whole point of this gate", () => {
    for (const t of [
      "what's the total",
      "maybe",
      "which one",
      "actually create a quotation for Rajan",
      "",
      "123",
    ]) {
      expect(classifyConfirmationReply(t)).toBe("other")
    }
  })

  it("only matches at the start of the message, not a 'yes' buried mid-sentence", () => {
    expect(classifyConfirmationReply("I don't think yes is right")).toBe("other")
  })
})

function userText(text: string): Anthropic.Beta.BetaMessageParam {
  return { role: "user", content: text }
}
function assistantText(text: string): Anthropic.Beta.BetaMessageParam {
  return { role: "assistant", content: [{ type: "text", text }] }
}
function userToolResult(): Anthropic.Beta.BetaMessageParam {
  return { role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "ok" }] }
}
function assistantToolUse(): Anthropic.Beta.BetaMessageParam {
  return { role: "assistant", content: [{ type: "tool_use", id: "x", name: "get_quotation", input: {} }] }
}

describe("trimToRecentTurns", () => {
  it("keeps everything when under the limit", () => {
    const msgs = [userText("hi"), assistantText("hello")]
    expect(trimToRecentTurns(msgs, 5)).toEqual(msgs)
  })

  it("drops only whole earlier turns, keeping the most recent N", () => {
    const turn1 = [userText("turn 1"), assistantText("reply 1")]
    const turn2 = [userText("turn 2"), assistantText("reply 2")]
    const turn3 = [userText("turn 3"), assistantText("reply 3")]
    const all = [...turn1, ...turn2, ...turn3]
    expect(trimToRecentTurns(all, 2)).toEqual([...turn2, ...turn3])
    expect(trimToRecentTurns(all, 1)).toEqual(turn3)
  })

  it("never cuts inside a tool_use/tool_result round trip, even across many tool calls", () => {
    const turn1 = [userText("turn 1"), assistantText("reply 1")]
    const turn2 = [userText("turn 2"), assistantToolUse(), userToolResult(), assistantToolUse(), userToolResult(), assistantText("reply 2")]
    const all = [...turn1, ...turn2]
    // Keeping only the most recent 1 turn must still include the FULL tool round trip, not a slice of it.
    expect(trimToRecentTurns(all, 1)).toEqual(turn2)
  })
})
