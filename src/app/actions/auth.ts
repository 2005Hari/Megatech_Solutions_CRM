"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionToken,
  getAuthConfig,
  passwordMatches,
  safeNextPath,
} from "@/lib/auth-token"

export type LoginState = { error?: string }

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const cfg = getAuthConfig()
  if (cfg.mode === "disabled") redirect("/")
  if (cfg.mode === "unconfigured") return { error: `Sign-in is not configured. ${cfg.reason}` }

  const password = formData.get("password")
  const ok = typeof password === "string" && (await passwordMatches(password, cfg.password, cfg.secret))

  if (!ok) {
    // Slow down guessing.
    await new Promise(resolve => setTimeout(resolve, 600))
    return { error: "Incorrect password." }
  }

  ;(await cookies()).set(SESSION_COOKIE, await createSessionToken(cfg.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  })

  const next = formData.get("next")
  redirect(safeNextPath(typeof next === "string" ? next : null))
}

export async function logout(): Promise<void> {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/login")
}
