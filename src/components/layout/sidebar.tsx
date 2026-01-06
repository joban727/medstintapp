"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { useState } from "react"

export interface SidebarItem {
  name: string
  href: string
  icon: any
  hasSubmenu?: boolean
}

interface SidebarProps {
  items: SidebarItem[]
  user?: any
  unified?: boolean
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({
  items,
  user,
  unified = false,
  isCollapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg glass"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Menu className="w-6 h-6 text-white" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar - full width drawer */}
      <aside
        className={cn(
          "lg:hidden fixed left-0 top-0 h-screen w-64 glass-sidebar z-40 transition-transform duration-300",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-[rgba(255,255,255,var(--glass-border-opacity))]">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-theme-gradient flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-xl font-bold text-white">MedStint</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-88px)]">
          {items.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive
                    ? "glass text-white"
                    : "text-[var(--text-tertiary)] hover:text-white hover:bg-[rgba(255,255,255,var(--ui-opacity-10))]"
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-colors flex-shrink-0",
                    isActive ? "text-white" : "text-[var(--text-muted)] group-hover:text-white"
                  )}
                />
                <span className="font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Desktop Sidebar - Collapsible */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col h-full transition-all duration-300 ease-in-out",
          unified ? "dashboard-sidebar-unified" : "glass-sidebar",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b border-[rgba(255,255,255,var(--glass-border-opacity))]">
          <Link href="/" className={cn("flex items-center gap-3", isCollapsed && "justify-center")}>
            <div className="w-10 h-10 rounded-xl bg-theme-gradient flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            {!isCollapsed && <span className="text-xl font-bold text-white">MedStint</span>}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className={cn("space-y-1", isCollapsed ? "px-2" : "px-3")}>
            {items.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={isCollapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-xl transition-all duration-200 group",
                    isCollapsed
                      ? "flex-col justify-center py-3 px-2 gap-1"
                      : "flex-row gap-3 px-4 py-3",
                    isActive
                      ? "glass text-white"
                      : "text-[var(--text-tertiary)] hover:text-white hover:bg-[rgba(255,255,255,var(--ui-opacity-10))]"
                  )}
                >
                  <Icon
                    className={cn(
                      "transition-colors flex-shrink-0",
                      isCollapsed ? "w-6 h-6" : "w-5 h-5",
                      isActive ? "text-white" : "text-[var(--text-muted)] group-hover:text-white"
                    )}
                  />
                  {isCollapsed ? (
                    <span className="text-[10px] font-medium text-center leading-tight truncate w-full">
                      {item.name.split(" ")[0]}
                    </span>
                  ) : (
                    <span className="font-medium">{item.name}</span>
                  )}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* User section at bottom - optional */}
        {user && !isCollapsed && (
          <div className="p-4 border-t border-[rgba(255,255,255,var(--glass-border-opacity))]">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-theme-gradient flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user.name?.charAt(0) || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{user.role}</p>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
