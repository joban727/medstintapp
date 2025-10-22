"use client"

import { Search, Bell, Settings, User } from "lucide-react"
import { useState } from "react"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { useUser } from "@clerk/nextjs"
import type { UserRole } from "@/types/auth"
import { useTheme } from "next-themes"

interface HeaderProps {
  userRole: UserRole
}

export function Header({ userRole }: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const { user } = useUser()
  const displayName = user?.fullName || user?.firstName || "User"
  // Use consistent logo to prevent hydration mismatch
  const logoSrc = "/logo-medstint.svg"

  return (
    <header className="fixed top-0 right-0 left-0 z-50 h-16 border-gray-200 border-b bg-white dark:bg-slate-900">
      <div className="flex h-full items-center justify-between px-6">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Image
              src={logoSrc}
              alt="MedStint Logo"
              width={40}
              height={40}
              className="h-10 w-10"
            />
            <span className="font-bold text-gray-900 text-xl dark:text-white">MedStint</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mx-8 max-w-md flex-1">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
            <Input
              type="text"
              placeholder="Search students, rotations, evaluations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2 pr-4 pl-10"
            />
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-5 w-5" />
            <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 p-0 text-xs">
              3
            </Badge>
          </Button>

          {/* Settings */}
          <Button variant="ghost" size="sm">
            <Settings className="h-5 w-5" />
          </Button>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.imageUrl} alt={displayName} />
                  <AvatarFallback>
                    {displayName
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
                <div className="flex flex-col space-y-1">
                  <p className="font-medium text-sm leading-none">{displayName}</p>
                  <p className="text-muted-foreground text-xs leading-none">
                    {user?.primaryEmailAddress?.emailAddress}
                  </p>
                  <Badge variant="secondary" className="mt-1 w-fit text-xs">
                    {userRole.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
