"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useUser, useClerk } from "@clerk/nextjs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Menu,
  Bell,
  Settings,
  ChevronDown,
  User,
  LogOut,
  CreditCard,
  LayoutDashboard,
  X,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import type { SidebarItem } from "./sidebar"

interface Tab {
  name: string
  href: string
  hasDropdown?: boolean
}

interface HeaderProps {
  title: string
  tabs?: Tab[]
  navItems?: SidebarItem[]
  isSidebarCollapsed?: boolean
  onToggleSidebar?: () => void
}

export function Header({
  title,
  tabs,
  navItems = [],
  isSidebarCollapsed = false,
  onToggleSidebar,
}: HeaderProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user } = useUser()
  const { signOut } = useClerk()
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/notifications")
        if (res.ok) {
          const data = await res.json()
          setNotifications(data)
          setUnreadCount(data.length)
        }
      } catch (error) {
        console.error("Failed to fetch notifications", error)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchNotifications()
    }
  }, [user])

  return (
    <TooltipProvider>
      <header className="relative z-50 px-4 sm:px-6 pt-4">
        {/* Top Bar - Right Actions Only (Logo shown in sidebar) */}
        <div className="flex items-center justify-end mb-4">
          {/* Right Icons */}
          <div className="flex items-center gap-1 sm:gap-1.5 lg:gap-2">
            {/* Notifications Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="glass-circle" size="icon-lg" className="relative">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span
                      className="absolute top-1 right-1 w-2.5 h-2.5 bg-theme-gradient rounded-full border-2"
                      style={{ borderColor: "var(--theme-bg-color)" }}
                    />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[85vw] sm:w-80 glass-dropdown border-[rgba(255,255,255,var(--glass-border-opacity))]"
                align="end"
                sideOffset={12}
              >
                <DropdownMenuLabel className="text-[var(--text-tertiary)]">
                  Notifications
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[rgba(255,255,255,var(--ui-opacity-10))]" />
                {loading ? (
                  <div className="p-4 text-center text-sm text-[var(--text-muted)]">Loading...</div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-[var(--text-muted)]">
                    No new notifications
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="text-[var(--text-secondary)] focus:bg-[rgba(255,255,255,var(--ui-opacity-10))] focus:text-white cursor-pointer flex-col items-start"
                    >
                      <span className="font-medium">{notification.title}</span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {notification.message}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator className="bg-[rgba(255,255,255,var(--ui-opacity-10))]" />
                <DropdownMenuItem className="text-[var(--text-secondary)] focus:bg-[rgba(255,255,255,var(--ui-opacity-10))] focus:text-white cursor-pointer justify-center">
                  <span className="text-sm">View all notifications</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Avatar Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="ml-2 border-2 border-[rgba(255,255,255,var(--glass-border-opacity))] hover:border-[rgba(255,255,255,var(--ui-opacity-20))] transition-colors cursor-pointer">
                  <AvatarImage src={user?.imageUrl} alt={user?.fullName || "User"} />
                  <AvatarFallback>{user?.firstName?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 glass-dropdown border-[rgba(255,255,255,var(--glass-border-opacity))]"
                align="end"
                sideOffset={12}
              >
                <DropdownMenuLabel className="text-[var(--text-tertiary)]">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium text-white">{user?.fullName || "User"}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {user?.primaryEmailAddress?.emailAddress || ""}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[rgba(255,255,255,var(--ui-opacity-10))]" />
                <DropdownMenuItem className="text-[var(--text-secondary)] focus:bg-[rgba(255,255,255,var(--ui-opacity-10))] focus:text-white cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="text-[var(--text-secondary)] focus:bg-[rgba(255,255,255,var(--ui-opacity-10))] focus:text-white cursor-pointer">
                  <CreditCard className="mr-2 h-4 w-4" />
                  <span>Billing</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/settings"
                    className="text-[var(--text-secondary)] focus:bg-[rgba(255,255,255,var(--ui-opacity-10))] focus:text-white cursor-pointer flex items-center w-full"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[rgba(255,255,255,var(--ui-opacity-10))]" />
                <DropdownMenuItem
                  className="text-red-400 focus:bg-[rgba(255,255,255,var(--ui-opacity-10))] focus:text-red-400 cursor-pointer"
                  onClick={() => signOut()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Navigation Bar */}
        <div className="glass-header px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
            {/* Desktop: Sidebar Toggle, Mobile: Menu icon (opens drawer) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-white hover:bg-[rgba(255,255,255,var(--ui-opacity-10))] transition-all duration-200"
                  onClick={() => {
                    if (window.innerWidth >= 1024 && onToggleSidebar) {
                      onToggleSidebar()
                    } else {
                      setMobileMenuOpen(true)
                    }
                  }}
                >
                  {isSidebarCollapsed ? (
                    <PanelLeft className="hidden lg:block w-5 h-5" />
                  ) : (
                    <PanelLeftClose className="hidden lg:block w-5 h-5" />
                  )}
                  <Menu className="lg:hidden w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="hidden lg:block">
                <p>{isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}</p>
              </TooltipContent>
            </Tooltip>

            {/* Title */}
            <h1 className="text-base sm:text-lg md:text-xl font-semibold text-white whitespace-nowrap flex-shrink-0">
              {title}
            </h1>

            {/* Tabs - hidden on mobile */}
            {tabs && tabs.length > 0 && (
              <nav className="hidden md:flex items-center gap-1 ml-2 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => {
                  const isActive =
                    pathname === tab.href ||
                    (tab.href !== "/" && pathname.startsWith(tab.href)) ||
                    (tab.href === "/" && pathname === "/")

                  return (
                    <Link
                      key={tab.name}
                      href={tab.href}
                      className={cn(
                        "flex items-center gap-1 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300",
                        isActive
                          ? "bg-theme-gradient text-white"
                          : "text-[var(--text-tertiary)] hover:text-white hover:bg-[rgba(255,255,255,var(--ui-opacity-10))]"
                      )}
                    >
                      {tab.name}
                      {tab.hasDropdown && <ChevronDown className="w-4 h-4 ml-0.5" />}
                    </Link>
                  )
                })}
              </nav>
            )}
          </div>
        </div>

        {/* Drawer Menu - Works on both mobile and desktop */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[100]">
            {/* Overlay */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Drawer */}
            <div className="absolute left-0 top-0 h-full w-72 glass-sidebar animate-slide-in">
              {/* Header */}
              <div className="p-5 border-b border-[rgba(255,255,255,var(--glass-border-opacity))] flex items-center justify-between">
                <Link
                  href="/"
                  className="flex items-center gap-3"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <div className="w-10 h-10 rounded-xl bg-theme-gradient flex items-center justify-center">
                    <span className="text-white font-bold text-lg">M</span>
                  </div>
                  <span className="text-xl font-bold text-white">MedStint</span>
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[var(--text-tertiary)] hover:text-white hover:bg-[rgba(255,255,255,var(--ui-opacity-10))]"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              {/* Navigation Links - Dynamic based on user role */}
              <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-88px)]">
                {navItems.length > 0 ? (
                  navItems.map((item) => {
                    const Icon = item.icon
                    const isActive =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href))

                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
                          isActive
                            ? "glass text-white"
                            : "text-[var(--text-tertiary)] hover:text-white hover:bg-[rgba(255,255,255,var(--ui-opacity-10))]"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-5 h-5 transition-colors",
                            isActive ? "text-white" : "text-[var(--text-muted)]"
                          )}
                        />
                        <span className="font-medium">{item.name}</span>
                      </Link>
                    )
                  })
                ) : (
                  <div className="text-center text-[var(--text-muted)] py-4">
                    No navigation items available
                  </div>
                )}

                {/* Divider */}
                <div className="my-4 border-t border-[rgba(255,255,255,var(--glass-border-opacity))]" />
              </nav>
            </div>
          </div>
        )}
      </header>
    </TooltipProvider>
  )
}
