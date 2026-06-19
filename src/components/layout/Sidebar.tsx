"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  FileText, 
  ShoppingCart, 
  PackageOpen,
  Settings
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Suppliers", href: "/suppliers", icon: Truck },
  { name: "Quotations", href: "/quotations", icon: FileText },
  { name: "Customer Orders", href: "/cpo", icon: ShoppingCart },
  { name: "Supplier Orders", href: "/spo", icon: PackageOpen },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-[260px] flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-14 shrink-0 items-center px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-accent-foreground font-semibold text-xs">
            M
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            MegaTech
          </span>
        </Link>
      </div>
      
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
        <div className="text-xs font-medium text-muted-foreground mb-4 px-3 uppercase tracking-wider">
          Menu
        </div>
        <nav className="flex-1 space-y-0.5">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-muted text-foreground" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  )}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
        
        <div className="mt-auto pt-6 pb-2">
          <Link
            href="/settings"
            className="group flex items-center gap-x-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-all duration-300 group-hover:rotate-45" strokeWidth={2} />
            Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
