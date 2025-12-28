"use client"

import * as React from "react"
import { type LucideIcon, AlertCircle, CheckCircle2, Info, Clock } from "lucide-react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// ============================================================================
// Activity Type Definitions
// ============================================================================

const activityTypeVariants = cva("rounded-full p-1.5", {
  variants: {
    type: {
      info: "bg-blue-100 dark:bg-blue-900/50",
      success: "bg-green-100 dark:bg-green-900/50",
      warning: "bg-orange-100 dark:bg-orange-900/50",
      error: "bg-red-100 dark:bg-red-900/50",
      default: "bg-gray-100 dark:bg-gray-800",
    },
  },
  defaultVariants: {
    type: "default",
  },
})

const activityIconVariants = cva("h-3.5 w-3.5", {
  variants: {
    type: {
      info: "text-blue-600 dark:text-blue-400",
      success: "text-green-600 dark:text-green-400",
      warning: "text-orange-600 dark:text-orange-400",
      error: "text-red-600 dark:text-red-400",
      default: "text-gray-600 dark:text-gray-400",
    },
  },
  defaultVariants: {
    type: "default",
  },
})

type ActivityType = "info" | "success" | "warning" | "error" | "default"

const typeIcons: Record<ActivityType, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: AlertCircle,
  default: Clock,
}

// ============================================================================
// ActivityList Component
// ============================================================================

interface Activity {
  id: string
  message: string
  time: string
  type?: ActivityType
  icon?: LucideIcon
}

interface ActivityListProps extends React.HTMLAttributes<HTMLElement> {
  /** Section title */
  title?: string
  /** Section description */
  description?: string
  /** Array of activities to display */
  activities: Activity[]
  /** Maximum number of activities to show */
  maxItems?: number
  /** Maximum height of the list container */
  maxHeight?: string
  /** Show empty state message */
  emptyMessage?: string
}

/**
 * Unified activity list component for displaying recent activities.
 */
const ActivityList = React.forwardRef<HTMLDivElement, ActivityListProps>(
  (
    {
      title = "Recent Activity",
      description,
      activities,
      maxItems,
      emptyMessage = "No recent activity",
      className,
      maxHeight,
      ...props
    },
    ref
  ) => {
    const displayedActivities = maxItems ? activities.slice(0, maxItems) : activities

    return (
      <Card ref={ref} className={cn("glass-card-subtle rounded-xl", className)} {...props}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {displayedActivities.length > 0 ? (
            <div
              className={cn("space-y-3", maxHeight && "overflow-y-auto pr-2")}
              style={{ maxHeight: maxHeight }}
            >
              <ul className="space-y-3" role="list" aria-label={title}>
                {displayedActivities.map((activity) => {
                  const type = activity.type || "default"
                  const Icon = activity.icon || typeIcons[type]

                  return (
                    <li
                      key={activity.id}
                      className="list-item-interactive group flex items-start space-x-3 rounded-lg border border-transparent p-3 hover:bg-muted/50 hover:border-border/50 transition-all duration-200"
                      role="listitem"
                    >
                      <div className={cn(activityTypeVariants({ type }), "transition-transform group-hover:scale-110")} aria-hidden="true">
                        <Icon className={cn(activityIconVariants({ type }))} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm py-4">{emptyMessage}</p>
          )}
        </CardContent>
      </Card>
    )
  }
)
ActivityList.displayName = "ActivityList"

// ============================================================================
// TaskList Component
// ============================================================================

const taskPriorityVariants = cva("h-2 w-2 rounded-full", {
  variants: {
    priority: {
      high: "bg-red-500",
      medium: "bg-yellow-500",
      low: "bg-green-500",
    },
  },
  defaultVariants: {
    priority: "medium",
  },
})

interface Task {
  id: string
  title: string
  description?: string
  dueDate?: string
  priority?: "high" | "medium" | "low"
  count?: number
  href?: string
  actionLabel?: string
}

interface TaskListProps extends React.HTMLAttributes<HTMLElement> {
  /** Section title */
  title?: string
  /** Section description */
  description?: string
  /** Array of tasks to display */
  tasks: Task[]
  /** Callback when action button is clicked */
  onActionClick?: (taskId: string) => void
  /** Show empty state message */
  emptyMessage?: string
}

/**
 * Unified task list component for displaying pending tasks with priorities.
 */
const TaskList = React.forwardRef<HTMLDivElement, TaskListProps>(
  (
    {
      title = "Pending Tasks",
      description,
      tasks,
      onActionClick,
      emptyMessage = "No pending tasks",
      className,
      ...props
    },
    ref
  ) => {
    return (
      <Card ref={ref} className={cn("glass-card-subtle rounded-xl", className)} {...props}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          {tasks.length > 0 ? (
            <ul className="space-y-3" role="list" aria-label={title}>
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="list-item-interactive group flex items-center justify-between rounded-lg border border-transparent p-3 hover:bg-muted/50 hover:border-border/50 transition-all duration-200"
                  role="listitem"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={cn(taskPriorityVariants({ priority: task.priority }), "ring-2 ring-offset-2 ring-transparent group-hover:ring-border transition-all")}
                      aria-label={`${task.priority || "medium"} priority`}
                    />
                    <div>
                      <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{task.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.dueDate}
                        {task.count !== undefined && ` • ${task.count} items`}
                      </p>
                    </div>
                  </div>
                  {(task.href || onActionClick) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => onActionClick?.(task.id)}
                      asChild={!!task.href}
                    >
                      {task.href ? (
                        <a href={task.href}>{task.actionLabel || "Review"}</a>
                      ) : (
                        <span>{task.actionLabel || "Review"}</span>
                      )}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground text-sm py-4">{emptyMessage}</p>
          )}
        </CardContent>
      </Card>
    )
  }
)
TaskList.displayName = "TaskList"

export { ActivityList, TaskList, activityTypeVariants, activityIconVariants, taskPriorityVariants }
export type { Activity, ActivityListProps, Task, TaskListProps, ActivityType }
