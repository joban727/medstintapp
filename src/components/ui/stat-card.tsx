"use client"

import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardCard } from "@/components/dashboard/shared/dashboard-card"
import { Button } from "@/components/ui/button"

/**
 * CVA variants for StatCard styling
 * Follows the same pattern as Button and Badge components
 */
const statCardVariants = cva(
  "card-hover-lift relative overflow-hidden rounded-xl transition-all duration-300 border border-border/50 shadow-sm hover:shadow-md",
  {
    variants: {
      variant: {
        blue: "hover:border-blue-500/30 after:absolute after:inset-0 after:bg-gradient-to-br after:from-blue-500/5 after:to-transparent after:opacity-0 hover:after:opacity-100 after:transition-opacity",
        green: "hover:border-green-500/30 after:absolute after:inset-0 after:bg-gradient-to-br after:from-green-500/5 after:to-transparent after:opacity-0 hover:after:opacity-100 after:transition-opacity",
        orange: "hover:border-orange-500/30 after:absolute after:inset-0 after:bg-gradient-to-br after:from-orange-500/5 after:to-transparent after:opacity-0 hover:after:opacity-100 after:transition-opacity",
        purple: "hover:border-purple-500/30 after:absolute after:inset-0 after:bg-gradient-to-br after:from-purple-500/5 after:to-transparent after:opacity-0 hover:after:opacity-100 after:transition-opacity",
        teal: "hover:border-teal-500/30 after:absolute after:inset-0 after:bg-gradient-to-br after:from-teal-500/5 after:to-transparent after:opacity-0 hover:after:opacity-100 after:transition-opacity",
      },
      size: {
        default: "p-6",
        compact: "p-4",
      },
    },
    defaultVariants: {
      variant: "blue",
      size: "default",
    },
  }
)

const iconContainerVariants = cva("flex items-center justify-center rounded-lg p-3 transition-colors duration-300", {
  variants: {
    variant: {
      blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30",
      green: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 group-hover:bg-green-100 dark:group-hover:bg-green-900/30",
      orange: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30",
      purple: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30",
      teal: "bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30",
    },
  },
  defaultVariants: {
    variant: "blue",
  },
})

const progressBarVariants = cva("h-full rounded-full transition-all duration-500 ease-out", {
  variants: {
    variant: {
      blue: "bg-gradient-to-r from-blue-500 to-blue-600",
      green: "bg-gradient-to-r from-green-500 to-green-600",
      orange: "bg-gradient-to-r from-orange-500 to-orange-600",
      purple: "bg-gradient-to-r from-purple-500 to-purple-600",
      teal: "bg-gradient-to-r from-teal-500 to-teal-600",
    },
  },
  defaultVariants: {
    variant: "blue",
  },
})

interface StatCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof statCardVariants> {
  /** Card title displayed at the top */
  title: string
  /** Main value to display (number will be formatted with locale) */
  value: string | number
  /** Description text below the value */
  description?: string
  /** Icon component from lucide-react */
  icon: LucideIcon
  /** Link for the action button */
  href?: string
  /** Label for the action button */
  actionLabel?: string
  /** Progress bar configuration */
  progress?: {
    value: number
    max: number
    /** Accessible label for screen readers */
    label?: string
  }
}

/**
 * Unified stat card component with consistent styling.
 * Used across all dashboards for displaying key metrics.
 *
 * @example
 * ```tsx
 * <StatCard
 *   title="Total Students"
 *   value={150}
 *   icon={Users}
 *   variant="blue"
 *   description="+12% from last month"
 * />
 * ```
 */
const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  (
    {
      title,
      value,
      description,
      icon: Icon,
      variant,
      size,
      href,
      actionLabel,
      progress,
      className,
      ...props
    },
    ref
  ) => {
    const progressPercentage = progress ? Math.min((progress.value / progress.max) * 100, 100) : 0

    return (
      <DashboardCard
        ref={ref}
        variant="glass"
        className={cn(statCardVariants({ variant, size }), className)}
        role="region"
        aria-label={`${title}: ${value}`}
        {...props}
      >
        <CardHeader className="flex flex-row items-center justify-between gap-0 pb-2">
          <CardTitle className="font-medium text-sm text-foreground">{title}</CardTitle>
          <div className={cn(iconContainerVariants({ variant }))} aria-hidden="true">
            <Icon className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="font-bold text-3xl text-foreground animate-stat-value">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
          {description && <p className="text-muted-foreground text-xs">{description}</p>}
          {progress && (
            <div
              className="mt-2 h-1 w-full bg-secondary rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={progress.value}
              aria-valuemin={0}
              aria-valuemax={progress.max}
              aria-label={progress.label || `${title} progress`}
            >
              <div
                className={cn(progressBarVariants({ variant }))}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          )}
          {href && actionLabel && (
            <div className="mt-3">
              <Button variant="outline" size="sm" asChild>
                <a href={href}>{actionLabel}</a>
              </Button>
            </div>
          )}
        </CardContent>
      </DashboardCard>
    )
  }
)
StatCard.displayName = "StatCard"

// ============================================================================
// StatGrid Component
// ============================================================================

const statGridVariants = cva("grid gap-4 stagger-children", {
  variants: {
    columns: {
      2: "md:grid-cols-2",
      3: "md:grid-cols-2 lg:grid-cols-3",
      4: "md:grid-cols-2 lg:grid-cols-4",
      5: "md:grid-cols-2 lg:grid-cols-5",
    },
  },
  defaultVariants: {
    columns: 4,
  },
})

interface StatGridProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof statGridVariants> { }

/**
 * Grid container for stat cards with responsive column layout.
 * Automatically applies stagger animation to children.
 */
const StatGrid = React.forwardRef<HTMLDivElement, StatGridProps>(
  ({ columns, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(statGridVariants({ columns }), className)}
        role="group"
        aria-label="Statistics overview"
        {...props}
      >
        {children}
      </div>
    )
  }
)
StatGrid.displayName = "StatGrid"

export { StatCard, StatGrid, statCardVariants, statGridVariants }
export type { StatCardProps, StatGridProps }
