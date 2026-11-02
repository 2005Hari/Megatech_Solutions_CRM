import { Prisma } from "@prisma/client"
import { UserError } from "./errors"

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export const GENERIC_ERROR = "Something went wrong. Please try again."

/** Translate a thrown value into a message that is safe to show to a user. */
export function toUserMessage(err: unknown): string {
  if (err instanceof UserError) return err.message

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = (err.meta?.target as string[] | string | undefined) ?? ""
        const fields = Array.isArray(target) ? target.join(", ") : String(target)
        return fields
          ? `A record with this ${fields} already exists.`
          : "A record with these details already exists."
      }
      case "P2003":
        return "This record is linked to other records and cannot be changed or deleted."
      case "P2025":
        return "That record no longer exists. It may have been deleted."
    }
  }

  return GENERIC_ERROR
}

function isFrameworkControlFlow(err: unknown): boolean {
  // redirect() / notFound() throw special errors that Next.js must see.
  const digest = (err as { digest?: unknown } | null)?.digest
  return typeof digest === "string" && digest.startsWith("NEXT_")
}

/**
 * Run a server action body and convert the outcome into an `ActionResult`.
 * Expected failures become `{ ok: false, error }`; unexpected ones are logged
 * and reported generically.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (err) {
    if (isFrameworkControlFlow(err)) throw err
    const message = toUserMessage(err)
    if (message === GENERIC_ERROR) console.error("[action] unexpected error:", err)
    return { ok: false, error: message }
  }
}
