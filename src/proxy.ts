import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, getAuthConfig, verifySessionToken } from "@/lib/auth-token"

/**
 * API routes that authenticate themselves and must stay reachable without a
 * browser session cookie (e.g. the WhatsApp webhook, verified by Meta's HMAC
 * signature - see src/app/api/whatsapp/webhook/route.ts).
 */
const SELF_AUTHENTICATING_PREFIXES = ["/api/whatsapp/"]

/**
 * Gate every page behind the login. (Server actions re-check on their own via
 * `requireAuth()`, because they can be POSTed to directly.)
 */
export async function proxy(request: NextRequest) {
  const { pathname: earlyPathname } = request.nextUrl
  if (SELF_AUTHENTICATING_PREFIXES.some(p => earlyPathname.startsWith(p))) {
    return NextResponse.next()
  }

  const cfg = getAuthConfig()

  if (cfg.mode === "disabled") return NextResponse.next()

  if (cfg.mode === "unconfigured") {
    return new NextResponse(`Authentication is not configured. ${cfg.reason}`, { status: 503 })
  }

  const { pathname, search } = request.nextUrl
  const authenticated = await verifySessionToken(cfg.secret, request.cookies.get(SESSION_COOKIE)?.value)

  if (pathname === "/login") {
    if (authenticated) return NextResponse.redirect(new URL("/", request.url))
    return NextResponse.next()
  }

  if (authenticated) return NextResponse.next()

  // A server action POST can't follow a redirect to a page sensibly.
  if (request.headers.has("next-action")) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const loginUrl = new URL("/login", request.url)
  if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
