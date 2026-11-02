import LoginForm from "./LoginForm"

export const metadata = { title: "Sign in · MegaTech OMS" }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-card-border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-foreground font-semibold">
            M
          </div>
          <div>
            <div className="text-base font-semibold text-foreground leading-tight">MegaTech OMS</div>
            <div className="text-xs text-muted-foreground">Sign in to continue</div>
          </div>
        </div>
        <LoginForm next={next ?? ""} />
      </div>
    </div>
  )
}
