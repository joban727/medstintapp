"use client"

import type { ReactNode } from "react"
import type { UserRole } from "../../types"
import { Header } from "./Header"
import Sidebar from "./Sidebar"

interface DashboardLayoutProps {
  children: ReactNode
  userRole: UserRole
}

export function DashboardLayout({ children, userRole }: DashboardLayoutProps) {
  // User data will be fetched from Clerk authentication
  // and passed down from the parent component

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userRole={userRole} />
      <div className="flex">
        <Sidebar />
        <main className="ml-64 flex-1 pt-16">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
