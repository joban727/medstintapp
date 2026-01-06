"use client"

import { SignOutButton } from "@clerk/nextjs"
import {
  CreditCard,
  History,
  Home,
  Lock,
  LogOut,
  MoreVertical,
  LayoutDashboard,
  User,
  Settings,
} from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserRole } from "@/types"

interface UserType {
  id: string
  email: string
  name: string
  role: UserRole
  schoolId: string | null
  programId: string | null
}

interface NavUserProps {
  user: UserType
}

export function NavUser({ user }: NavUserProps) {
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 outline-none group">
          <Avatar className="h-8 w-8 border-2 border-[rgba(255,255,255,var(--glass-border-opacity))] group-hover:border-[rgba(255,255,255,var(--ui-opacity-20))] transition-colors">
            <AvatarImage src="" alt={displayName} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start text-sm">
            <span className="font-medium truncate max-w-[100px]">{displayName}</span>
          </div>
          <MoreVertical className="h-4 w-4 text-muted-foreground hidden md:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 glass-dropdown border-[rgba(255,255,255,var(--glass-border-opacity))]"
        align="end"
        sideOffset={8}
      >
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="font-medium">{displayName}</p>
            <p className="w-[200px] truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator className="bg-[rgba(255,255,255,var(--ui-opacity-10))]" />
        <Link href="/dashboard">
          <DropdownMenuItem className="cursor-pointer gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/dashboard/settings">
          <DropdownMenuItem className="cursor-pointer gap-2">
            <User className="h-4 w-4" />
            <span>Account</span>
          </DropdownMenuItem>
        </Link>
        <Link href="/dashboard/billing">
          <DropdownMenuItem className="cursor-pointer gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Billing</span>
          </DropdownMenuItem>
        </Link>
        <DropdownMenuItem className="cursor-pointer gap-2">
          <Lock className="h-4 w-4" />
          <span>Security</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer gap-2">
          <History className="h-4 w-4" />
          <span>History</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[rgba(255,255,255,var(--ui-opacity-10))]" />
        <Link href="/">
          <DropdownMenuItem className="cursor-pointer gap-2">
            <Home className="h-4 w-4" />
            <span>Homepage</span>
          </DropdownMenuItem>
        </Link>
        <SignOutButton signOutOptions={{ redirectUrl: "/" }}>
          <DropdownMenuItem className="cursor-pointer gap-2 text-red-500 focus:text-red-500">
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </DropdownMenuItem>
        </SignOutButton>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
