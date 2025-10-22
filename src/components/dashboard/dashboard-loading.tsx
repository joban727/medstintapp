"use client"

import { Loader2 } from "lucide-react"
import Image from "next/image"
import { motion } from "../ui/motion"
import { useTheme } from "next-themes"

export function DashboardLoading() {
  return (
    <output
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-surface-1 to-surface-2"
      aria-label="Loading dashboard"
    >
      <div className="space-y-6 text-center">
        {/* Logo */}
        <div className="flex items-center justify-center space-x-3">
          <div>
            <Image
              src="/logo-medstint.svg"
              alt="MedStint Logo"
              width={80}
              height={80}
              className="h-20 w-20"
            />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-medical-blue to-healthcare-green bg-clip-text font-bold text-3xl text-transparent">
              MedStint
            </h1>
            <p className="text-text-muted text-base">Clinical Education Platform</p>
          </div>
        </div>

        {/* Loading Indicator */}
        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <Loader2 className="h-6 w-6 animate-spin text-medical-blue" aria-hidden="true" />
            <span className="font-semibold text-text-secondary text-lg">Loading your dashboard...</span>
          </div>
        </div>

        {/* Loading Message */}
        <div className="mx-auto max-w-md text-text-muted text-base">
          <p>Preparing your personalized clinical education experience...</p>
        </div>
      </div>
      <span className="sr-only">Loading dashboard, please wait...</span>
    </output>
  )
}

// Alternative compact loading component for use in other contexts
export function DashboardLoadingCompact() {
  return (
    <output className="flex items-center justify-center p-8" aria-label="Loading">
      <div className="space-y-4 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
        <p className="text-gray-600">Loading dashboard...</p>
      </div>
      <span className="sr-only">Loading content...</span>
    </output>
  )
}

// Loading skeleton for dashboard cards
export function DashboardCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="animate-pulse">
        <div className="space-y-4 rounded-lg border bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="h-3 w-1/3 rounded bg-gray-200 sm:h-4" />
            <div className="h-3 w-3 rounded bg-gray-200 sm:h-4 sm:w-4" />
          </div>
          <div className="h-5 w-1/2 rounded bg-gray-200 sm:h-8" />
          <div className="h-2 w-2/3 rounded bg-gray-200 sm:h-3" />
        </div>
      </div>
    </div>
  )
}

// Loading skeleton for dashboard stats grid
export function DashboardStatsSkeleton() {
  const _skeletonItems = ["stats-1", "stats-2", "stats-3", "stats-4"]
  return (
    <output className="space-y-4 sm:space-y-6" aria-label="Loading dashboard">
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
        aria-hidden="true"
      >
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-7" aria-hidden="true">
        <DashboardCardSkeleton className="lg:col-span-4" />
        <DashboardCardSkeleton className="lg:col-span-3" />
      </div>
    </output>
  )
}
