"use client"

import { cn } from "@/lib/utils"
import { InputHTMLAttributes, forwardRef } from "react"

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> { }

const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
    ({ className, ...props }, ref) => {
        return (
            <input
                ref={ref}
                className={cn(
                    "glass-input w-full px-4 py-3 text-white placeholder:text-white/40",
                    "focus:outline-none focus:ring-1 focus:ring-white/20",
                    className
                )}
                {...props}
            />
        )
    }
)

GlassInput.displayName = "GlassInput"

export { GlassInput }
