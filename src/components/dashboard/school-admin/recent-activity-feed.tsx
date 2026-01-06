"use client"

import { motion } from "framer-motion"
import { Activity, User, FileEdit, CheckCircle2, AlertCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

interface RecentActivity {
  action: string
  details: string
  timestamp: string
}

interface RecentActivityFeedProps {
  activities: RecentActivity[]
}

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  const getActivityIcon = (action: string) => {
    if (action.includes("create") || action.includes("add")) return FileEdit
    if (action.includes("approve") || action.includes("verify")) return CheckCircle2
    if (action.includes("alert") || action.includes("warning")) return AlertCircle
    if (action.includes("user") || action.includes("login")) return User
    return Activity
  }

  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-muted-foreground/50">
        <Clock className="h-5 w-5 mr-2 opacity-50" />
        <span className="text-sm">No recent activity</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {activities.slice(0, 6).map((activity, index) => {
        const Icon = getActivityIcon(activity.action.toLowerCase())
        const date = new Date(activity.timestamp)
        const timeAgo = formatDistanceToNow(date, { addSuffix: true })

        return (
          <motion.div
            key={`${activity.timestamp}-${index}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: index * 0.05 }}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-full cursor-pointer",
              "bg-white/5 border border-white/10",
              "hover:bg-white/10 hover:border-white/20 hover:scale-105",
              "transition-all duration-300 backdrop-blur-sm",
              "text-xs text-[var(--text-tertiary)] hover:text-white"
            )}
            title={`${activity.action}: ${activity.details} (${timeAgo})`}
          >
            <Icon className="h-3.5 w-3.5 text-info shrink-0" />
            <span className="truncate max-w-[120px]">{activity.action}</span>
            <span className="text-[var(--text-muted)] shrink-0">{timeAgo.replace(" ago", "")}</span>
          </motion.div>
        )
      })}
    </div>
  )
}
