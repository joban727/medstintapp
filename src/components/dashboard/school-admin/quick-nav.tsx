"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DashboardCard } from "@/components/dashboard/shared/dashboard-card"

interface QuickAction {
    title: string
    description: string
    href: string
    icon: LucideIcon
    color: string
    gradient: string
}

interface QuickNavProps {
    actions: QuickAction[]
}

export function QuickNav({ actions }: QuickNavProps) {
    return (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {actions.map((action, index) => (
                <motion.div
                    key={action.href}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                >
                    <Link href={action.href} className="block group">
                        <DashboardCard
                            variant="default"
                            className={cn(
                                "flex flex-col items-center gap-2 p-4 transition-all duration-300",
                                "hover:shadow-md hover:-translate-y-0.5 border-border/50 hover:border-border"
                            )}
                            noPadding
                        >
                            <div className={cn(
                                "p-3 rounded-xl transition-transform group-hover:scale-110",
                                "bg-primary/5 text-primary",
                                "shadow-sm"
                            )}>
                                <action.icon className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-medium text-center text-muted-foreground group-hover:text-foreground line-clamp-1">
                                {action.title.split(' ')[0]}
                            </span>
                        </DashboardCard>
                    </Link>
                </motion.div>
            ))}
        </div>
    )
}
