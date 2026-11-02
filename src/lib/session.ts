import { cookies } from "next/headers"
import { SESSION_COOKIE, getAuthConfig, verifySessionToken } from "./auth-token"
import { UserError } from "./errors"

/** True if the current request carries a valid session (or auth is disabled in dev). */
export async function isAuthenticated(): Promise<boolean> {
  const cfg = getAuthConfig()
  if (cfg.mode === "disabled") return true
  if (cfg.mode === "unconfigured") return false

  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return verifySessionToken(cfg.secret, token)
}

/**
 * Call at the top of EVERY server action. `proxy.ts` protects page loads, but
 * server actions are separately reachable by direct POST, so each one has to
 * verify the caller itself (see the Next.js data-security guide).
 */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) {
    throw new UserError("Your session has expired. Please sign in again.")
  }
}
