"use client"

import { AlertTriangle, ChevronRight, RefreshCw } from "lucide-react"
import React from "react"
import { cn } from "@/lib/utils"
import type { DashboardCardProps } from "@/types/dashboard"
import { Alert, AlertDescription } from "../ui/alert"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { LoadingSkeleton } from "../ui/loading-skeleton"

interface EnhancedDashboardCardProps extends DashboardCardProps {
  icon?: React.ComponentType<{ className?: string }>
  action?: {
    label: string
    onClick: () => void
    variant?: "default" | "outline" | "ghost"
  }
  collapsible?: boolean
  defaultCollapsed?: boolean
  showRetryButton?: boolean
  emptyState?: {
    title: string
    description: string
    icon?: React.ComponentType<{ className?: string }>
    action?: {
      label: string
      onClick: () => void
    }
  }
}

export function DashboardCard({
  title,
  description,
  children,
  loading = false,
  error = null,
  onRetry,
  className,
  icon: Icon,
  action,
  collapsible = false,
  defaultCollapsed = false,
  showRetryButton = true,
  emptyState,
}: EnhancedDashboardCardProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed)
  const [isRetrying, setIsRetrying] = React.useState(false)

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return

    setIsRetrying(true)
    try {
      await onRetry()
    } finally {
      setIsRetrying(false)
    }
  }

  const hasContent = React.Children.count(children) > 0
  const showEmptyState = !loading && !error && !hasContent && emptyState

  return (
    <Card className={cn(className)}>
      <CardHeader
        className={cn(
          "flex flex-row items-center justify-between space-y-0 pb-2",
          collapsible &&
            "cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        onClick={collapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  setIsCollapsed(!isCollapsed)
                }
              }
            : undefined
        }
        tabIndex={collapsible ? 0 : undefined}
        role={collapsible ? "button" : undefined}
        aria-expanded={collapsible ? !isCollapsed : undefined}
        aria-label={collapsible ? `${title} section` : undefined}
      >
        <div className="flex items-center space-x-2">
          {Icon && (
            <Icon className="h-4 w-4 text-muted-foreground sm:h-5 sm:w-5" aria-hidden="true" />
          )}
          <div>
            <CardTitle className="font-medium text-sm sm:text-base">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1 text-xs sm:text-sm">{description}</CardDescription>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {action && (
            <Button
              variant={action.variant || "outline"}
              size="sm"
              className="h-7 px-2 text-xs sm:h-8 sm:px-3 sm:text-sm"
              onClick={(e) => {
                e.stopPropagation()
                action.onClick()
              }}
            >
              {action.label}
            </Button>
          )}

          {collapsible && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 touch-manipulation p-0 sm:h-8 sm:w-8"
              onClick={(e) => {
                e.stopPropagation()
                setIsCollapsed(!isCollapsed)
              }}
              aria-label={isCollapsed ? "Expand section" : "Collapse section"}
              aria-expanded={!isCollapsed}
            >
              <ChevronRight
                className={cn(
                  "h-3 w-3 sm:h-4 sm:w-4",
                  isCollapsed ? "rotate-0" : "rotate-90"
                )}
                aria-hidden="true"
              />
            </Button>
          )}
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent className="pt-0">
          {loading && (
            <output className="space-y-3" aria-label="Loading content">
              <LoadingSkeleton count={3} height="h-4" />
              <span className="sr-only">Loading...</span>
            </output>
          )}

          {error && (
            <Alert variant="destructive" role="alert" aria-live="polite">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription className="flex items-center justify-between">
                <span className="flex-1">{error}</span>
                {showRetryButton && onRetry && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="ml-2 h-7"
                    aria-label={isRetrying ? "Retrying operation" : "Retry operation"}
                  >
                    <RefreshCw
                      className={cn("mr-1 h-3 w-3", isRetrying && "animate-spin")}
                      aria-hidden="true"
                    />
                    {isRetrying ? "Retrying..." : "Retry"}
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          {showEmptyState && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {emptyState.icon && (
                <emptyState.icon className="mb-6 h-16 w-16 text-text-muted" />
              )}
              <h3 className="mb-2 font-semibold text-text-primary text-base">{emptyState.title}</h3>
              <p className="mb-6 text-text-secondary text-sm">{emptyState.description}</p>
              {emptyState.action && (
                <Button variant="outline" size="sm" onClick={emptyState.action.onClick}>
                  {emptyState.action.label}
                </Button>
              )}
            </div>
          )}

          {!loading && !error && hasContent && children}
        </CardContent>
      )}
    </Card>
  )
}

// Specialized dashboard cards
export function StatCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  loading = false,
  className,
}: {
  title: string
  value: string | number
  change?: string
  trend?: "up" | "down" | "neutral"
  icon?: React.ComponentType<{ className?: string }>
  loading?: boolean
  className?: string
}) {
  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <LoadingSkeleton height="h-4" className="w-24" />
            <LoadingSkeleton height="h-4 w-4" className="rounded" />
          </div>
          <div className="mt-2">
            <LoadingSkeleton height="h-8" className="w-16" />
          </div>
          <div className="mt-1">
            <LoadingSkeleton height="h-3" className="w-20" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="font-medium text-muted-foreground text-xs sm:text-sm">{title}</p>
          {Icon && (
            <Icon className="h-3 w-3 text-muted-foreground sm:h-4 sm:w-4" aria-hidden="true" />
          )}
        </div>
        <div className="mt-2">
          <div className="font-bold text-lg sm:text-2xl">
            <span className="sr-only">{title}: </span>
            {value}
          </div>
          {change && (
            <div
              className={cn(
                "text-xs",
                trend === "up" && "text-green-600",
                trend === "down" && "text-red-600",
                trend === "neutral" && "text-muted-foreground"
              )}
            >
              <span className="sr-only">Trend: {trend === "up" ? "Up" : trend === "down" ? "Down" : "Neutral"} </span>
              {change}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Progress card for competencies, hours, etc.
export function ProgressCard({
  title,
  current,
  total,
  unit = "",
  icon: Icon,
  loading = false,
  className,
}: {
  title: string
  current: number
  total: number
  unit?: string
  icon?: React.ComponentType<{ className?: string }>
  loading?: boolean
  className?: string
}) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="mb-2 flex items-center justify-between">
            <LoadingSkeleton height="h-4" className="w-24" />
            <LoadingSkeleton height="h-4 w-4" className="rounded" />
          </div>
          <LoadingSkeleton height="h-6" className="mb-2 w-20" />
          <LoadingSkeleton height="h-2" className="mb-1 w-full" />
          <LoadingSkeleton height="h-3" className="w-16" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <p className="font-medium text-muted-foreground text-xs sm:text-sm">{title}</p>
          {Icon && (
            <Icon className="h-3 w-3 text-muted-foreground sm:h-4 sm:w-4" aria-hidden="true" />
          )}
        </div>
        <div className="mt-2">
          <p className="font-bold text-base sm:text-xl">
            {current}
            {unit} / {total}
            {unit}
          </p>
          <div className="mt-2">
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(percentage, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-muted-foreground text-xs">{percentage}% complete</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
