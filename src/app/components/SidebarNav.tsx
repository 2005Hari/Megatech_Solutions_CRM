"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, ShoppingCart, Factory, Calculator, Users } from "lucide-react";

export default function SidebarNav() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, category: "Overview" },
    { href: "/contacts", label: "Contacts", icon: Users, category: "Overview" },
    { href: "/quotations", label: "Quotations", icon: FileText, category: "Modules" },
    { href: "/cpo", label: "Customer POs", icon: ShoppingCart, category: "Modules" },
    { href: "/spo", label: "Supplier POs", icon: Factory, category: "Modules" },
    { href: "/margins", label: "Margins", icon: Calculator, category: "Modules" },
  ];

  // Group by category
  const categories = ["Overview", "Modules"];

  return (
    <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
      {categories.map((cat) => (
        <div key={cat} className="space-y-1.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">
            {cat}
          </div>
          {links
            .filter((link) => link.category === cat)
            .map((link) => {
              const Icon = link.icon;
              // Check if active: exact match or starts with path for subpages
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname.startsWith(link.href + "/");

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                    isActive
                      ? "bg-red-50 text-red-600 font-semibold"
                      : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
                  }`}
                >
                  <Icon
                    size={18}
                    className={`transition-colors duration-200 ${
                      isActive
                        ? "text-red-600"
                        : "text-slate-400 group-hover:text-slate-500"
                    }`}
                  />
                  {link.label}
                </Link>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
