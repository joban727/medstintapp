"use client"

import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon | React.ReactNode
  description?: string
  trend?: {
    value: number
    label: string
  }
  variant?: "default" | "blue" | "green" | "orange" | "purple" | "red" | "teal"
  className?: string
}

const variantClasses = {
  default: "",
  blue: "border-l-4 border-l-blue-500",
  green: "border-l-4 border-l-green-500",
  orange: "border-l-4 border-l-orange-500",
  purple: "border-l-4 border-l-purple-500",
  red: "border-l-4 border-l-red-500",
  teal: "border-l-4 border-l-teal-500",
}

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = "default",
  className,
}: StatCardProps) {
  // Properly render the icon - check if it's already a React element or a component
  const renderIcon = () => {
    // If it's already a valid React element (JSX), return as-is
    if (React.isValidElement(Icon)) {
      return Icon
    }
    // If it's a component (function or forwardRef), render it
    if (typeof Icon === "function" || (Icon && typeof Icon === "object" && "$$typeof" in Icon)) {
      const IconComponent = Icon as React.ComponentType<{ className?: string }>
      return <IconComponent className="h-4 w-4" />
    }
    // Fallback
    return null
  }

  return (
    <Card
      className={cn(
        "bg-white/5 backdrop-blur-md border-white/10 rounded-xl border transition-all duration-300",
        variantClasses[variant],
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="h-4 w-4 text-muted-foreground">{renderIcon()}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(description || trend) && (
          <p className="text-xs text-muted-foreground">
            {trend && (
              <span
                className={cn(
                  "mr-1 font-medium",
                  trend.value > 0 ? "text-green-500" : "text-red-500"
                )}
              >
                {trend.value > 0 ? "+" : ""}
                {trend.value}%
              </span>
            )}
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function StatGrid({
  children,
  className,
  columns = 4,
}: {
  children: React.ReactNode
  className?: string
  columns?: 2 | 3 | 4 | 5
}) {
  const colClasses = {
    2: "grid gap-4 md:grid-cols-2",
    3: "grid gap-4 md:grid-cols-2 lg:grid-cols-3",
    4: "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
    5: "grid gap-4 md:grid-cols-2 lg:grid-cols-5",
  }
  return <div className={cn(colClasses[columns], className)}>{children}</div>
}
