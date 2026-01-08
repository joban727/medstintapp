"use client"

import { cn } from "@/lib/utils"
import { HTMLAttributes, forwardRef } from "react"

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: "default" | "subtle" | "liquid"
    hover?: boolean
    noPadding?: boolean
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
    ({ className, variant = "default", hover = false, noPadding = false, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "relative rounded-xl transition-all duration-300 animate-fade-in",
                    variant === "subtle" ? "glass-card-subtle" : variant === "liquid" ? "glass-card-liquid" : "glass-card",
                    !noPadding && "p-6",
                    hover && "cursor-pointer hover:-translate-y-1",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)

GlassCard.displayName = "GlassCard"

export { GlassCard }
