"use client"

import * as React from "react"
import Link from "next/link"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface QuickActionCardProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string
    description: string
    icon: LucideIcon
    href: string
    color?: string
    badge?: string | number
    actionLabel?: string
}

export const QuickActionCard = React.forwardRef<HTMLDivElement, QuickActionCardProps>(
    (
        {
            title,
            description,
            icon: Icon,
            href,
            color = "bg-blue-500",
            badge,
            actionLabel = "Access",
            className,
            ...props
        },
        ref
    ) => {
        return (
            <Card
                ref={ref}
                className={cn(
                    "quick-action-btn glass-card-subtle card-hover-lift rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group relative overflow-hidden",
                    className
                )}
                {...props}
            >
                <div className={cn(
                    "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none",
                    `bg-gradient-to-br from-${color.replace('bg-', '')}/5 to-transparent`
                )} />

                <CardHeader className="relative z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className={cn(
                                "rounded-lg p-2.5 transition-colors duration-300",
                                color,
                                "bg-opacity-10 text-opacity-100",
                                // Map background colors to text colors for the icon
                                color.includes("blue") && "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 group-hover:bg-blue-100",
                                color.includes("green") && "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 group-hover:bg-green-100",
                                color.includes("purple") && "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400 group-hover:bg-purple-100",
                                color.includes("orange") && "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 group-hover:bg-orange-100",
                                color.includes("cyan") && "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400 group-hover:bg-cyan-100",
                                color.includes("red") && "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 group-hover:bg-red-100",
                                color.includes("indigo") && "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 group-hover:bg-indigo-100",
                                color.includes("gray") && "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400 group-hover:bg-gray-100"
                            )}>
                                <Icon className="h-5 w-5" />
                            </div>
                            <CardTitle className="text-sm font-medium">{title}</CardTitle>
                        </div>
                        {badge && (
                            <Badge variant="destructive" className="text-xs animate-pulse">
                                {badge}
                            </Badge>
                        )}
                    </div>
                    <CardDescription className="text-xs mt-2 line-clamp-2">{description}</CardDescription>
                </CardHeader>
                <CardContent className="relative z-10 pt-0">
                    <Button asChild size="sm" className="w-full group-hover:translate-x-1 transition-transform duration-300" variant="ghost">
                        <Link href={href} className="flex items-center justify-between w-full">
                            {actionLabel}
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        )
    }
)
QuickActionCard.displayName = "QuickActionCard"
