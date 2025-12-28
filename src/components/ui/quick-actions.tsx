"use client"

import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// ============================================================================
// QuickActions Container
// ============================================================================

interface QuickActionsProps extends React.HTMLAttributes<HTMLElement> {
  /** Section title */
  title?: string
  /** Optional badge text */
  badge?: string
}

/**
 * Container for quick action buttons with optional title and badge.
 */
const QuickActions = React.forwardRef<HTMLElement, QuickActionsProps>(
  ({ title = "Quick Actions", badge, children, className, ...props }, ref) => {
    return (
      <section ref={ref} className={cn("space-y-4", className)} aria-label={title} {...props}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-xl">{title}</h2>
          {badge && (
            <Badge variant="outline" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
        <div className="bento-grid stagger-children" role="group" aria-label="Available actions">
          {children}
        </div>
      </section>
    )
  }
)
QuickActions.displayName = "QuickActions"

// ============================================================================
// QuickActionCard Component
// ============================================================================

const quickActionCardVariants = cva(
  "quick-action-btn glass-card-subtle card-hover-lift rounded-xl relative overflow-hidden group",
  {
    variants: {
      variant: {
        default: "",
        highlighted: "ring-2 ring-primary/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const iconBgVariants = cva("rounded-md p-2", {
  variants: {
    color: {
      blue: "bg-blue-500",
      green: "bg-green-500",
      purple: "bg-purple-500",
      orange: "bg-orange-500",
      red: "bg-red-500",
      cyan: "bg-cyan-500",
      gray: "bg-gray-500",
      indigo: "bg-indigo-500",
    },
  },
  defaultVariants: {
    color: "blue",
  },
})

interface QuickActionCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof quickActionCardVariants> {
  /** Action title */
  title: string
  /** Action description */
  description: string
  /** Icon component */
  icon: LucideIcon
  /** Link destination */
  href: string
  /** Icon background color */
  color?: "blue" | "green" | "purple" | "orange" | "red" | "cyan" | "gray" | "indigo"
  /** Optional badge count */
  badge?: {
    count: number
    variant?: "default" | "secondary" | "destructive" | "outline"
  }
  /** Button label */
  actionLabel?: string
}

/**
 * Individual quick action card with icon, description, and link.
 */
const QuickActionCard = React.forwardRef<HTMLDivElement, QuickActionCardProps>(
  (
    {
      title,
      description,
      icon: Icon,
      href,
      color = "blue",
      badge,
      variant,
      actionLabel,
      className,
      ...props
    },
    ref
  ) => {
    return (
      <Card ref={ref} className={cn(quickActionCardVariants({ variant }), className)} {...props}>
        <CardHeader className="relative">
          <div className="flex items-start justify-between">
            <div className={cn(iconBgVariants({ color }))} aria-hidden="true">
              <Icon className="h-4 w-4 text-white" />
            </div>
            {badge && badge.count > 0 && (
              <Badge variant={badge.variant || "secondary"} className="text-xs">
                {badge.count}
              </Badge>
            )}
          </div>
          <CardTitle className="mt-3 text-base">{title}</CardTitle>
          <CardDescription className="text-xs">{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="w-full transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground"
          >
            <Link href={href}>{actionLabel || `Access ${title.split(" ")[0]}`}</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }
)
QuickActionCard.displayName = "QuickActionCard"

// ============================================================================
// Legacy Support: QuickActionsFromArray
// ============================================================================

interface QuickAction {
  title: string
  description: string
  icon: LucideIcon
  href: string
  color?: "blue" | "green" | "purple" | "orange" | "red" | "cyan" | "gray" | "indigo"
  badge?: {
    count: number
    variant?: "default" | "secondary" | "destructive" | "outline"
  }
}

interface QuickActionsFromArrayProps extends Omit<QuickActionsProps, "children"> {
  /** Array of action configurations */
  actions: QuickAction[]
}

/**
 * Quick actions from array - convenience component for rendering
 * multiple actions from a configuration array.
 */
const QuickActionsFromArray = React.forwardRef<HTMLElement, QuickActionsFromArrayProps>(
  ({ actions, ...props }, ref) => {
    return (
      <QuickActions ref={ref} {...props}>
        {actions.map((action) => (
          <QuickActionCard
            key={action.title}
            title={action.title}
            description={action.description}
            icon={action.icon}
            href={action.href}
            color={action.color}
            badge={action.badge}
          />
        ))}
      </QuickActions>
    )
  }
)
QuickActionsFromArray.displayName = "QuickActionsFromArray"

export {
  QuickActions,
  QuickActionCard,
  QuickActionsFromArray,
  quickActionCardVariants,
  iconBgVariants,
}
export type { QuickActionsProps, QuickActionCardProps, QuickAction }
