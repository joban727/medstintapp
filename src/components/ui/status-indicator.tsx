"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type StatusVariant =
  | "default"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "neutral"
  | "active"
  | "inactive"
  | "pending"

interface StatusIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: StatusVariant
  size?: "sm" | "md" | "lg"
  pulse?: boolean
}

const variantStyles: Record<StatusVariant, string> = {
  default: "bg-primary",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-gray-500",
  active: "bg-green-500",
  inactive: "bg-gray-400",
  pending: "bg-yellow-500",
}

const sizeStyles = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
}

export function StatusIndicator({
  variant = "default",
  size = "md",
  pulse = false,
  className,
  ...props
}: StatusIndicatorProps) {
  return (
    <div
      className={cn(
        "rounded-full shrink-0",
        variantStyles[variant],
        sizeStyles[size],
        pulse && "animate-pulse",
        className
      )}
      {...props}
    />
  )
}
