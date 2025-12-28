"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ResponsiveTableProps {
    children: React.ReactNode
    className?: string
}

/**
 * Responsive table wrapper that adds horizontal scrolling on mobile
 * and ensures tables don't break layout on small screens.
 */
export function ResponsiveTableWrapper({
    children,
    className,
}: ResponsiveTableProps) {
    return (
        <div className={cn("w-full overflow-x-auto", className)}>
            {children}
        </div>
    )
}

interface MobileDataCardProps {
    children: React.ReactNode
    className?: string
}

/**
 * A card representation of a table row for mobile views.
 * Uses the glass-card design pattern for consistency.
 */
export function MobileDataCard({
    children,
    className,
}: MobileDataCardProps) {
    return (
        <div
            className={cn(
                "glass-card rounded-lg p-4 space-y-3 mb-3 last:mb-0",
                className
            )}
        >
            {children}
        </div>
    )
}

interface MobileDataFieldProps {
    label: string
    children: React.ReactNode
    className?: string
}

/**
 * A field within a mobile data card showing label and value.
 */
export function MobileDataField({
    label,
    children,
    className,
}: MobileDataFieldProps) {
    return (
        <div className={cn("flex justify-between items-center gap-2", className)}>
            <span className="text-muted-foreground text-sm font-medium">{label}</span>
            <span className="text-sm font-medium text-right">{children}</span>
        </div>
    )
}

interface ResponsiveFilterBarProps {
    children: React.ReactNode
    className?: string
}

/**
 * A filter bar that stacks on mobile and spreads on desktop.
 */
export function ResponsiveFilterBar({
    children,
    className,
}: ResponsiveFilterBarProps) {
    return (
        <div
            className={cn(
                "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                "glass-card-subtle p-4 rounded-lg",
                className
            )}
        >
            {children}
        </div>
    )
}

interface ResponsiveFilterGroupProps {
    children: React.ReactNode
    className?: string
}

/**
 * A group of filter controls that wrap on mobile.
 */
export function ResponsiveFilterGroup({
    children,
    className,
}: ResponsiveFilterGroupProps) {
    return (
        <div
            className={cn(
                "flex flex-wrap gap-2 items-center",
                className
            )}
        >
            {children}
        </div>
    )
}
