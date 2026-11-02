"use client"

import { usePathname } from "next/navigation"
import Sidebar from "./Sidebar"
import Header from "./Header"

/** The sidebar/header chrome, except on the bare login and print pages. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === "/login" || pathname?.startsWith("/print/")) return <>{children}</>

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-background/50 p-6">{children}</main>
      </div>
    </div>
  )
}
