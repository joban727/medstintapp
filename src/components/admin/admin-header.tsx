"use client"

import { Bell, Clock, Settings, Shield, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface AdminHeaderProps {
  user: {
    name: string
    email?: string
    avatar?: string
  }
  className?: string
}

export function AdminHeader({ user, className }: AdminHeaderProps) {
  const currentTime = new Date().toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const displayEmail = user.email || "admin@medstint.com"

  return (
    <div className={cn("gap-4", className)}>
      {/* Top Bar */}
      <div className="flex items-center justify-between rounded-lg border bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-medical-primary" />
            <Badge variant="secondary" className="border-purple-200 dark:border-purple-800 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400">
              Welcome to the MedStint administration portal.
            </Badge>
          </div>
          <div className="hidden items-center gap-2 text-muted-foreground text-sm md:flex">
            <Clock className="h-4 w-4" />
            <span>{currentTime}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            <span className="-top-1 -right-1 absolute flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-xs">
              3
            </span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {user.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="font-medium text-sm leading-none">{user.name}</p>
                  <p className="text-muted-foreground text-xs leading-none">
                    {displayEmail}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-error">Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Welcome Section */}
      <div className="flex items-center justify-between">
        <div className="gap-1">
          <h1 className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text font-bold text-3xl text-transparent tracking-tight">
            System Administration
          </h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name}. Manage the entire MedStint platform.
          </p>
        </div>
        <div className="hidden items-center gap-2 text-muted-foreground text-sm lg:flex">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
            <span>System Online</span>
          </div>
          <span>•</span>
          <span>All services operational</span>
        </div>
      </div>
    </div>
  )
}
