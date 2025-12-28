"use client"

import { cn } from "@/lib/utils"
import { motion, HTMLMotionProps } from "framer-motion"

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode
  className?: string
  variant?: "default" | "premium" | "glass" | "ghost"
  hoverEffect?: boolean
  interactive?: boolean
  gradient?: string
}

export function GlassCard({
  children,
  className,
  variant = "default",
  hoverEffect = false,
  interactive = false,
  gradient,
  ...props
}: GlassCardProps) {
  const variants = {
    default: "bg-card/80 border-border/40 shadow-sm shadow-indigo-500/5",
    premium: "bg-card/90 border-primary/10 shadow-xl shadow-indigo-500/10",
    glass: "bg-card/60 border-border/30 backdrop-blur-xl shadow-sm",
    ghost: "bg-transparent border-transparent hover:bg-muted/5",
  }

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-2xl border backdrop-blur-md transition-all duration-300",
        variants[variant],
        (hoverEffect || interactive) && "hover:shadow-lg hover:shadow-indigo-500/10 hover:border-indigo-500/30",
        interactive && "cursor-pointer active:scale-[0.98]",
        gradient,
        className
      )}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      {...props}
    >
      {/* Hover Glow Effect */}
      {(hoverEffect || interactive) && (
        <div className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 blur-xl" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}
