"use client"

import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cn } from "@/lib/utils"
import { useEnhancedTheme } from "@/contexts/theme-context"

// Enhanced button variants with theme awareness
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        medical: "bg-medical-primary text-white hover:bg-medical-primary-hover shadow-sm",
        success: "bg-healthcare-green text-white hover:bg-healthcare-green-hover shadow-sm",
        warning: "bg-warning text-white hover:bg-warning-dark shadow-sm",
        error: "bg-error text-white hover:bg-error-dark shadow-sm",
        info: "bg-info text-white hover:bg-info-dark shadow-sm",
        gradient: "bg-gradient-to-r from-medical-primary to-medical-teal text-white hover:from-medical-primary-hover hover:to-medical-teal-dark shadow-md",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-12 rounded-lg px-10 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
        "icon-lg": "h-12 w-12",
      },
      density: {
        compact: "h-8 px-3 text-xs",
        comfortable: "",
        spacious: "h-12 px-6 text-base",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      density: "comfortable",
    },
  }
)

export interface ThemeAwareButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  loadingText?: string
}

const ThemeAwareButton = forwardRef<HTMLButtonElement, ThemeAwareButtonProps>(
  ({ 
    className, 
    variant, 
    size, 
    density,
    asChild = false, 
    loading = false,
    loadingText = "Loading...",
    children,
    disabled,
    ...props 
  }, ref) => {
    const { config } = useEnhancedTheme()
    const Comp = asChild ? Slot : "button"
    
    // Use density from theme config if not explicitly provided
    const effectiveDensity = density || config.density
    
    // Adjust animations based on theme config
    const animationClasses = cn(
      config.animations === 'none' && "transition-none",
      config.animations === 'reduced' && "transition-colors duration-150",
      config.animations === 'full' && "transition-all duration-200 hover:scale-105 active:scale-95"
    )
    
    // High contrast adjustments
    const contrastClasses = cn(
      config.contrast === 'high' && [
        "ring-2 ring-offset-2",
        variant === 'outline' && "border-2",
        "focus-visible:ring-4"
      ]
    )

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, density: effectiveDensity }),
          animationClasses,
          contrastClasses,
          loading && "cursor-not-allowed opacity-70",
          className
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {loadingText}
          </div>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
ThemeAwareButton.displayName = "ThemeAwareButton"

export { ThemeAwareButton, buttonVariants }