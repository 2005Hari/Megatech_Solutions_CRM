import { Prisma } from "@prisma/client"
import { describe, expect, it, vi } from "vitest"
import { GENERIC_ERROR, runAction, toUserMessage } from "@/lib/action-result"
import { UserError } from "@/lib/errors"

const prismaError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "test", meta })

describe("runAction", () => {
  it("wraps success", async () => {
    expect(await runAction(async () => 42)).toEqual({ ok: true, data: 42 })
  })

  it("surfaces UserError messages", async () => {
    const r = await runAction(async () => {
      throw new UserError("Nope")
    })
    expect(r).toEqual({ ok: false, error: "Nope" })
  })

  it("hides unexpected errors behind a generic message and logs them", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    const r = await runAction(async () => {
      throw new Error("connection string postgres://user:secret@host")
    })
    expect(r).toEqual({ ok: false, error: GENERIC_ERROR })
    expect(JSON.stringify(r)).not.toContain("secret")
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it("lets framework redirect/notFound errors through", async () => {
    const redirectLike = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" })
    await expect(runAction(async () => { throw redirectLike })).rejects.toBe(redirectLike)
  })
})

describe("toUserMessage", () => {
  it("translates prisma codes", () => {
    expect(toUserMessage(prismaError("P2002", { target: ["refNo"] }))).toBe("A record with this refNo already exists.")
    expect(toUserMessage(prismaError("P2003"))).toMatch(/linked to other records/)
    expect(toUserMessage(prismaError("P2025"))).toMatch(/no longer exists/)
    expect(toUserMessage(prismaError("P9999"))).toBe(GENERIC_ERROR)
  })
})
