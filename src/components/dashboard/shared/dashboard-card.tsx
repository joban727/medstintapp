import React from "react"
import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SpotlightCard } from "@/components/ui/spotlight-card"

interface DashboardCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  icon?: React.ReactNode
  variant?: "default" | "glass" | "glass-subtle" | "premium" | "flat"
  noPadding?: boolean
}

export const DashboardCard = React.forwardRef<HTMLDivElement, DashboardCardProps>(
  (
    {
      title,
      description,
      footer,
      icon,
      children,
      className,
      variant = "default",
      noPadding = false,
      ...props
    },
    ref
  ) => {
    // Design Language: Glassmorphism with hover effects
    const variantClasses = {
      default:
        "bg-white/5 backdrop-blur-md border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 rounded-xl border",
      glass:
        "bg-white/5 backdrop-blur-md border-white/10 hover:bg-white/10 hover:border-white/20 rounded-xl border",
      "glass-subtle":
        "bg-white/5 backdrop-blur-sm border-white/5 hover:bg-white/10 hover:border-white/10 rounded-xl border",
      premium:
        "bg-white/5 backdrop-blur-md border-white/15 hover:shadow-lg hover:border-white/25 hover:-translate-y-0.5 rounded-xl border",
      flat: "bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 shadow-none rounded-xl",
    }

    if (variant === "premium") {
      return (
        <SpotlightCard
          ref={ref}
          className={cn("transition-all duration-300 ease-out", variantClasses[variant], className)}
          {...props}
        >
          {(title || description || icon) && (
            <CardHeader
              className={cn(
                "flex flex-row items-start justify-between space-y-0 pb-2",
                noPadding && "px-0 pt-0"
              )}
            >
              <div className="space-y-1">
                {title && (
                  <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
                )}
                {description && (
                  <CardDescription className="text-sm text-muted-foreground">
                    {description}
                  </CardDescription>
                )}
              </div>
              {icon && <div className="text-muted-foreground">{icon}</div>}
            </CardHeader>
          )}
          <CardContent className={cn(noPadding ? "p-0" : "pt-0")}>{children}</CardContent>
          {footer && <CardFooter className={cn(noPadding && "px-0 pb-0")}>{footer}</CardFooter>}
        </SpotlightCard>
      )
    }

    return (
      <Card
        ref={ref}
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {(title || description || icon) && (
          <CardHeader
            className={cn(
              "flex flex-row items-start justify-between space-y-0 pb-2",
              noPadding && "px-0 pt-0"
            )}
          >
            <div className="space-y-1">
              {title && (
                <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
              )}
              {description && (
                <CardDescription className="text-sm text-muted-foreground">
                  {description}
                </CardDescription>
              )}
            </div>
            {icon && <div className="text-muted-foreground">{icon}</div>}
          </CardHeader>
        )}
        <CardContent className={cn(noPadding ? "p-0" : "pt-0")}>{children}</CardContent>
        {footer && <CardFooter className={cn(noPadding && "px-0 pb-0")}>{footer}</CardFooter>}
      </Card>
    )
  }
)
DashboardCard.displayName = "DashboardCard"
