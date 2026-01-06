"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * ResponsiveTableWrapper
 *
 * A wrapper component for tables that provides horizontal scrolling
 * and responsive behavior for desktop views.
 */
interface ResponsiveTableWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function ResponsiveTableWrapper({
  children,
  className,
  ...props
}: ResponsiveTableWrapperProps) {
  return (
    <div className={cn("w-full overflow-x-auto", className)} {...props}>
      {children}
    </div>
  )
}

/**
 * MobileDataCard
 *
 * A card component designed for displaying data items on mobile devices.
 * Provides consistent styling for mobile-first data presentation.
 */
interface MobileDataCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function MobileDataCard({ children, className, ...props }: MobileDataCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-white/5 backdrop-blur-md p-4 shadow-sm",
        "hover:bg-white/10 transition-all duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * MobileDataField
 *
 * A field component for displaying label-value pairs on mobile devices.
 * Used within MobileDataCard for consistent data presentation.
 */
interface MobileDataFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  children: React.ReactNode
}

export function MobileDataField({ label, children, className, ...props }: MobileDataFieldProps) {
  return (
    <div className={cn("flex items-center justify-between py-1.5", className)} {...props}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  )
}
