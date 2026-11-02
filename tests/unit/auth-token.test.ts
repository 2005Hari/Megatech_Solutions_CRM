import { describe, expect, it } from "vitest"
import {
  SESSION_TTL_MS,
  createSessionToken,
  getAuthConfig,
  passwordMatches,
  safeNextPath,
  verifySessionToken,
} from "@/lib/auth-token"

const SECRET = "a-sufficiently-long-test-secret"

describe("session tokens", () => {
  it("round-trips", async () => {
    const token = await createSessionToken(SECRET, 1_000)
    expect(await verifySessionToken(SECRET, token, 2_000)).toBe(true)
  })

  it("expires", async () => {
    const token = await createSessionToken(SECRET, 1_000)
    expect(await verifySessionToken(SECRET, token, 1_000 + SESSION_TTL_MS + 1)).toBe(false)
  })

  it("rejects a different secret, tampering and garbage", async () => {
    const token = await createSessionToken(SECRET, 1_000)
    expect(await verifySessionToken("another-secret-of-length", token, 2_000)).toBe(false)

    const [v, , sig] = token.split(".")
    // extend expiry but keep the old signature
    expect(await verifySessionToken(SECRET, `${v}.${Date.now() + 10 ** 12}.${sig}`, 2_000)).toBe(false)

    for (const bad of ["", "abc", "v1.1.2.3", "v2.1.abc", undefined, null]) {
      expect(await verifySessionToken(SECRET, bad as string | undefined, 2_000)).toBe(false)
    }
  })
})

describe("passwordMatches", () => {
  it("accepts only the exact password", async () => {
    expect(await passwordMatches("hunter2", "hunter2", SECRET)).toBe(true)
    expect(await passwordMatches("hunter3", "hunter2", SECRET)).toBe(false)
    expect(await passwordMatches("", "hunter2", SECRET)).toBe(false)
    expect(await passwordMatches("hunter2 ", "hunter2", SECRET)).toBe(false)
  })
})

describe("getAuthConfig", () => {
  it("is enabled when both vars are set", () => {
    expect(getAuthConfig({ AUTH_PASSWORD: "p", AUTH_SECRET: SECRET, NODE_ENV: "production" }).mode).toBe("enabled")
  })

  it("is open only in development with nothing configured", () => {
    expect(getAuthConfig({ NODE_ENV: "development" }).mode).toBe("disabled")
    expect(getAuthConfig({}).mode).toBe("disabled")
  })

  it("fails closed in production when unconfigured or half-configured", () => {
    expect(getAuthConfig({ NODE_ENV: "production" }).mode).toBe("unconfigured")
    expect(getAuthConfig({ NODE_ENV: "production", AUTH_PASSWORD: "p" }).mode).toBe("unconfigured")
    expect(getAuthConfig({ NODE_ENV: "development", AUTH_SECRET: SECRET }).mode).toBe("unconfigured")
  })

  it("rejects a short secret", () => {
    expect(getAuthConfig({ AUTH_PASSWORD: "p", AUTH_SECRET: "short" }).mode).toBe("unconfigured")
  })
})

describe("safeNextPath", () => {
  it("only allows same-site relative paths", () => {
    expect(safeNextPath("/quotations?page=2")).toBe("/quotations?page=2")
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil.com", "evil", "", null, undefined, "/login"]) {
      expect(safeNextPath(bad as string | null | undefined)).toBe("/")
    }
  })
})
