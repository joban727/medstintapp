"use client"

import { forwardRef, type HTMLAttributes } from "react"
import { cn } from "@/lib/utils"
import { useEnhancedTheme } from "@/contexts/theme-context"

// Theme-aware card variants
const cardVariants = {
  default: {
    base: "rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-300",
    light: "bg-white border-gray-200 shadow-sm hover:shadow-md",
    dark: "bg-gray-900 border-gray-800 shadow-lg hover:shadow-xl"
  },
  elevated: {
    base: "rounded-lg border bg-card text-card-foreground shadow-md transition-all duration-300",
    light: "bg-white border-gray-200 shadow-md hover:shadow-lg",
    dark: "bg-gray-800 border-gray-700 shadow-xl hover:shadow-2xl"
  },
  medical: {
    base: "rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-300",
    light: "bg-blue-50/50 border-blue-200 shadow-sm hover:shadow-md hover:bg-blue-50",
    dark: "bg-blue-950/50 border-blue-800 shadow-lg hover:shadow-xl hover:bg-blue-950/70"
  },
  success: {
    base: "rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-300",
    light: "bg-green-50/50 border-green-200 shadow-sm hover:shadow-md hover:bg-green-50",
    dark: "bg-green-950/50 border-green-800 shadow-lg hover:shadow-xl hover:bg-green-950/70"
  },
  warning: {
    base: "rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-300",
    light: "bg-yellow-50/50 border-yellow-200 shadow-sm hover:shadow-md hover:bg-yellow-50",
    dark: "bg-yellow-950/50 border-yellow-800 shadow-lg hover:shadow-xl hover:bg-yellow-950/70"
  },
  error: {
    base: "rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-300",
    light: "bg-red-50/50 border-red-200 shadow-sm hover:shadow-md hover:bg-red-50",
    dark: "bg-red-950/50 border-red-800 shadow-lg hover:shadow-xl hover:bg-red-950/70"
  }
}

export interface ThemeAwareCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof cardVariants
  interactive?: boolean
  noPadding?: boolean
}

const ThemeAwareCard = forwardRef<HTMLDivElement, ThemeAwareCardProps>(
  ({ className, variant = "default", interactive = false, noPadding = false, ...props }, ref) => {
    const { config } = useEnhancedTheme()
    
    const variantStyles = cardVariants[variant]
    
    return (
      <div
        ref={ref}
        className={cn(
          variantStyles.base,
          !noPadding && "p-6",
          interactive && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
          config.animations === 'none' && "transition-none",
          config.animations === 'reduced' && "transition-colors duration-150",
          className
        )}
        {...props}
      />
    )
  }
)
ThemeAwareCard.displayName = "ThemeAwareCard"

const ThemeAwareCardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
ThemeAwareCardHeader.displayName = "ThemeAwareCardHeader"

const ThemeAwareCardTitle = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight text-card-foreground",
      className
    )}
    {...props}
  />
))
ThemeAwareCardTitle.displayName = "ThemeAwareCardTitle"

const ThemeAwareCardDescription = forwardRef<
  HTMLParagraphElement,
  HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
ThemeAwareCardDescription.displayName = "ThemeAwareCardDescription"

const ThemeAwareCardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
ThemeAwareCardContent.displayName = "ThemeAwareCardContent"

const ThemeAwareCardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
ThemeAwareCardFooter.displayName = "ThemeAwareCardFooter"

export {
  ThemeAwareCard,
  ThemeAwareCardHeader,
  ThemeAwareCardTitle,
  ThemeAwareCardDescription,
  ThemeAwareCardContent,
  ThemeAwareCardFooter,
}