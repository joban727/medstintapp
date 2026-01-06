"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "success" | "danger" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
  isLoading?: boolean
  icon?: React.ReactNode
}

export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    { className, variant = "default", size = "default", isLoading, icon, children, ...props },
    ref
  ) => {
    const getVariantStyles = () => {
      switch (variant) {
        case "success":
          return "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30"
        case "danger":
          return "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/30"
        case "ghost":
          return "bg-transparent border-transparent text-white/70 hover:bg-white/5 hover:text-white"
        default:
          return "bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20"
      }
    }

    const getSizeStyles = () => {
      switch (size) {
        case "sm":
          return "h-9 px-3 text-xs"
        case "lg":
          return "h-12 px-8 text-lg"
        case "icon":
          return "h-10 w-10 p-0 flex items-center justify-center"
        default:
          return "h-10 px-4 py-2"
      }
    }

    return (
      <button
        ref={ref}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full font-medium transition-all duration-300",
          "border backdrop-blur-xl",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "group overflow-hidden",
          getVariantStyles(),
          getSizeStyles(),
          className
        )}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {/* Shimmer Effect */}
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <span className="relative flex items-center gap-2">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {!isLoading && icon && <span className="mr-1">{icon}</span>}
          {children}
        </span>
      </button>
    )
  }
)
GlassButton.displayName = "GlassButton"
