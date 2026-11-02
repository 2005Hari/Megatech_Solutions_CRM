/**
 * Session token primitives. Uses only Web Crypto so the exact same code runs
 * in `proxy.ts` and in Server Actions.
 *
 * Token format: `v1.<expiresAtMs>.<hex hmac-sha256(secret, "v1.<expiresAtMs>")>`
 */

export const SESSION_COOKIE = "mt_session"
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type AuthConfig =
  | { mode: "disabled" }
  | { mode: "unconfigured"; reason: string }
  | { mode: "enabled"; password: string; secret: string }

/**
 * - `enabled`: AUTH_PASSWORD and AUTH_SECRET (>= 16 chars) are set.
 * - `disabled`: nothing set AND not production (local development only).
 * - `unconfigured`: production without valid settings. The app fails CLOSED
 *   rather than silently serving everything to the internet.
 */
export function getAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig {
  const password = env.AUTH_PASSWORD
  const secret = env.AUTH_SECRET

  if (password && secret) {
    if (secret.length < 16) {
      return { mode: "unconfigured", reason: "AUTH_SECRET must be at least 16 characters." }
    }
    return { mode: "enabled", password, secret }
  }

  if (env.NODE_ENV !== "production" && !password && !secret) {
    return { mode: "disabled" }
  }

  return { mode: "unconfigured", reason: "Set AUTH_PASSWORD and AUTH_SECRET environment variables." }
}

const encoder = new TextEncoder()

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)))
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function createSessionToken(secret: string, now = Date.now()): Promise<string> {
  const expires = now + SESSION_TTL_MS
  const payload = `v1.${expires}`
  return `${payload}.${toHex(await hmac(secret, payload))}`
}

export async function verifySessionToken(
  secret: string,
  token: string | undefined | null,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false
  const parts = token.split(".")
  if (parts.length !== 3 || parts[0] !== "v1") return false

  const expires = Number(parts[1])
  if (!Number.isFinite(expires) || expires <= now) return false

  const expected = await hmac(secret, `v1.${parts[1]}`)
  return timingSafeEqual(encoder.encode(parts[2]), encoder.encode(toHex(expected)))
}

/** Constant-time password comparison (compares HMACs, so length does not leak). */
export async function passwordMatches(input: string, password: string, secret: string): Promise<boolean> {
  const [a, b] = await Promise.all([hmac(secret, `pw:${input}`), hmac(secret, `pw:${password}`)])
  return timingSafeEqual(a, b)
}

/** Only allow same-site relative redirects after login. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/"
  if (next === "/login" || next.startsWith("/login?")) return "/"
  return next
}
