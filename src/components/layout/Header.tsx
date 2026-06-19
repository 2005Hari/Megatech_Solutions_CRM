"use client";

import { Bell, Search } from "lucide-react";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border bg-background px-4 sm:px-6">
      <div className="flex flex-1 items-center gap-x-4 self-stretch lg:gap-x-6">
        <form className="relative flex flex-1" action="#" method="GET">
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <Search
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="search-field"
            className="block h-full w-full border-0 py-0 pl-8 pr-0 text-foreground bg-transparent placeholder:text-muted-foreground focus:ring-0 sm:text-sm"
            placeholder="Search..."
            type="search"
            name="search"
          />
        </form>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <button type="button" className="text-muted-foreground hover:text-foreground transition-colors relative">
            <span className="sr-only">View notifications</span>
            <Bell className="h-4 w-4" aria-hidden="true" />
          </button>
          
          <div className="hidden lg:block lg:h-4 lg:w-px lg:bg-sidebar-border" aria-hidden="true" />
          
          <button className="flex items-center gap-x-2 text-sm font-medium leading-6 text-foreground hover:opacity-80 transition-opacity">
            <div className="h-7 w-7 rounded-full bg-muted border border-sidebar-border flex items-center justify-center overflow-hidden">
               <span className="text-xs font-semibold text-muted-foreground">AU</span>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
