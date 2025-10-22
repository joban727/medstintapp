"use client"

import { SignOutButton } from "@clerk/nextjs"
import {
  RiBankCardLine,
  RiFindReplaceLine,
  RiHomeLine,
  RiLockLine,
  RiLogoutCircleLine,
  RiMore2Line,
  RiTimer2Line,
  RiUserLine,
} from "@remixicon/react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import type { UserRole } from "@/types"

interface User {
  id: string
  email: string
  name: string
  role: UserRole
  schoolId: string | null
  programId: string | null
}

interface NavUserProps {
  user: User
}

export function NavUser({ user }: NavUserProps) {
  const { isMobile } = useSidebar()

  // Get user's display name with fallbacks
  const displayName = user.name || user.email

  // Generate initials for fallback
  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user.email.slice(0, 2).toUpperCase()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:active:bg-transparent group-data-[collapsible=icon]:hover:bg-transparent"
            >
              <div className="flex w-full items-center">
                <Avatar className="in-data-[state=expanded]:size-6 transition-[width,height] duration-200 ease-in-out group-data-[collapsible=icon]:size-8">
                  <AvatarImage src="" alt={displayName} />
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div className="ms-1 grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-muted-foreground text-xs">{user.email}</span>
                </div>
                <div className="flex size-8 items-center justify-center rounded-lg bg-sidebar-accent/50 in-[[data-slot=dropdown-menu-trigger]:hover]:bg-transparent group-data-[collapsible=icon]:hidden">
                  <RiMore2Line className="size-5 opacity-40" size={20} />
                </div>
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <Link href="/dashboard">
              <DropdownMenuItem className="gap-3 px-1">
                <RiTimer2Line size={20} className="text-muted-foreground/70" aria-hidden="true" />
                <span>Dashboard</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/dashboard/settings">
              <DropdownMenuItem className="gap-3 px-1">
                <RiUserLine size={20} className="text-muted-foreground/70" aria-hidden="true" />
                <span>Account</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/dashboard/billing">
              <DropdownMenuItem className="gap-3 px-1">
                <RiBankCardLine size={20} className="text-muted-foreground/70" aria-hidden="true" />
                <span>Billing</span>
              </DropdownMenuItem>
            </Link>
            <DropdownMenuItem className="gap-3 px-1">
              <RiLockLine size={20} className="text-muted-foreground/70" aria-hidden="true" />
              <span>Security</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-3 px-1">
              <RiFindReplaceLine
                size={20}
                className="text-muted-foreground/70"
                aria-hidden="true"
              />
              <span>History</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <Link href="/">
              <DropdownMenuItem className="gap-3 px-1">
                <RiHomeLine size={20} className="text-muted-foreground/70" aria-hidden="true" />
                <span>Homepage</span>
              </DropdownMenuItem>
            </Link>

            <SignOutButton signOutOptions={{ redirectUrl: "/" }}>
              <DropdownMenuItem className="cursor-pointer gap-3 px-1">
                <RiLogoutCircleLine
                  size={20}
                  className="text-muted-foreground/70"
                  aria-hidden="true"
                />
                <span>Log out</span>
              </DropdownMenuItem>
            </SignOutButton>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
