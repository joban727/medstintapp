"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

// ============================================================================
// PageContainer Component
// ============================================================================

const pageContainerVariants = cva("container mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6", {
  variants: {
    maxWidth: {
      sm: "max-w-screen-sm",
      md: "max-w-screen-md",
      lg: "max-w-screen-lg",
      xl: "max-w-screen-xl",
      "2xl": "max-w-screen-2xl",
      full: "max-w-full",
    },
    padding: {
      default: "py-6",
      compact: "py-4",
      spacious: "py-8",
    },
  },
  defaultVariants: {
    maxWidth: "2xl",
    padding: "default",
  },
})

interface PageContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof pageContainerVariants> { }

/**
 * Unified page container component that provides consistent:
 * - Horizontal padding (responsive)
 * - Vertical padding (configurable)
 * - Max width constraints
 * - Vertical spacing between children
 *
 * @example
 * ```tsx
 * <PageContainer maxWidth="xl" padding="compact">
 *   <PageHeader title="Dashboard" />
 *   <PageSection title="Stats">...</PageSection>
 * </PageContainer>
 * ```
 */
const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  ({ maxWidth, padding, className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(pageContainerVariants({ maxWidth, padding }), className)}
        {...props}
      >
        {children}
      </div>
    )
  }
)
PageContainer.displayName = "PageContainer"

// ============================================================================
// PageHeader Component
// ============================================================================

interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Page title */
  title: string
  /** Optional description below title */
  description?: string
  /** Actions slot (buttons, badges, etc.) */
  children?: React.ReactNode
}

/**
 * Unified page header component with consistent styling.
 * Supports an optional actions slot via children.
 */
const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  ({ title, description, children, className, ...props }, ref) => {
    return (
      <header
        ref={ref}
        className={cn(
          "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border/40",
          className
        )}
        {...props}
      >
        <div className="space-y-1">
          <h1 className="font-bold text-2xl sm:text-3xl tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground text-sm sm:text-base max-w-2xl leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-3" role="group" aria-label="Page actions">
            {children}
          </div>
        )}
      </header>
    )
  }
)
PageHeader.displayName = "PageHeader"

// ============================================================================
// PageSection Component
// ============================================================================

interface PageSectionProps extends React.HTMLAttributes<HTMLElement> {
  /** Optional section title */
  title?: string
  /** Optional section description */
  description?: string
}

/**
 * Page section component for grouping related content with optional header.
 */
const PageSection = React.forwardRef<HTMLElement, PageSectionProps>(
  ({ title, description, children, className, ...props }, ref) => {
    return (
      <section
        ref={ref}
        className={cn("space-y-4", className)}
        aria-labelledby={title ? `section-${title.toLowerCase().replace(/\s+/g, "-")}` : undefined}
        {...props}
      >
        {(title || description) && (
          <div>
            {title && (
              <h2
                id={`section-${title.toLowerCase().replace(/\s+/g, "-")}`}
                className="font-semibold text-lg sm:text-xl text-foreground"
              >
                {title}
              </h2>
            )}
            {description && <p className="text-muted-foreground text-sm">{description}</p>}
          </div>
        )}
        {children}
      </section>
    )
  }
)
PageSection.displayName = "PageSection"

export { PageContainer, PageHeader, PageSection, pageContainerVariants }
export type { PageContainerProps, PageHeaderProps, PageSectionProps }
