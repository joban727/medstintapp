"use client"

import { Loader2 } from "lucide-react"
import { motion } from "../ui/motion"

import { DashboardBackground } from "./dashboard-background"

export function DashboardLoading() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      aria-label="Loading dashboard"
    >
      <DashboardBackground />

      {/* Central Animated Element */}
      <div className="relative flex items-center justify-center">
        {/* Outer rotating ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute h-32 w-32 rounded-full border-t-2 border-l-2 border-white/20"
        />

        {/* Inner rotating ring (reverse) */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          className="absolute h-24 w-24 rounded-full border-b-2 border-r-2 border-white/30"
        />

        {/* Pulsing Core */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="h-16 w-16 rounded-full bg-white/10 backdrop-blur-md shadow-[0_0_30px_rgba(255,255,255,0.2)]"
        />
      </div>
      <span className="sr-only">Loading dashboard...</span>
    </div>
  )
}

// Alternative compact loading component for use in other contexts
export function DashboardLoadingCompact() {
  return (
    <div className="flex items-center justify-center p-8" aria-label="Loading">
      <div className="gap-4 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-medical-primary" aria-hidden="true" />
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
      <span className="sr-only">Loading content...</span>
    </div>
  )
}

// Loading skeleton for dashboard cards
export function DashboardCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 sm:p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-3 w-1/3 rounded-md shimmer-loading sm:h-4" />
            <div className="h-10 w-10 rounded-lg shimmer-loading" />
          </div>
          <div className="h-8 w-1/2 rounded-md shimmer-loading sm:h-10" />
          <div className="h-2 w-2/3 rounded-md shimmer-loading sm:h-3" />
        </div>
      </div>
    </div>
  )
}

// Loading skeleton for dashboard stats grid
export function DashboardStatsSkeleton() {
  const _skeletonItems = ["stats-1", "stats-2", "stats-3", "stats-4"]

  return (
    <div className="space-y-4 sm:space-y-6 stagger-children" aria-label="Loading dashboard">
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
    </div>
  )
}
