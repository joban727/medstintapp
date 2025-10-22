"use client"

import { AppSidebar } from "../landing/medstint-features"
import { SidebarProvider } from "../ui/sidebar"
import type { User } from "@/types"

interface SidebarProps {
  user: User
}

export default function Sidebar({ user }: SidebarProps) {
  return (
    <SidebarProvider>
      <AppSidebar user={user} />
    </SidebarProvider>
  )
}
