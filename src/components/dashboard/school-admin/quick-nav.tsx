"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { SpotlightCard } from "@/components/ui/spotlight-card"

interface QuickAction {
  title: string
  description: string
  href: string
  icon: LucideIcon
  color: string
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
            <SpotlightCard
              className={cn(
                "flex flex-col items-center gap-2 p-4",
                "hover:shadow-md hover:-translate-y-0.5"
              )}
              spotlightColor="rgba(255, 255, 255, 0.1)"
            >
              <div
                className={cn(
                  "p-3 rounded-xl transition-all duration-300",
                  "bg-white/5 group-hover:bg-white/10",
                  "group-hover:scale-110 group-hover:shadow-sm"
                )}
              >
                <action.icon className="h-5 w-5 text-[var(--text-tertiary)] group-hover:text-white" />
              </div>
              <span className="text-xs font-medium text-center text-[var(--text-tertiary)] group-hover:text-white line-clamp-1 transition-colors">
                {action.title.split(" ")[0]}
              </span>
            </SpotlightCard>
          </Link>
        </motion.div>
      ))}
    </div>
  )
}
