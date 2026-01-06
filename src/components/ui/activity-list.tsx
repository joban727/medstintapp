import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import Link from "next/link"

// Original ActivityList interface for avatar-based activity
// Original ActivityList interface for avatar-based activity
export interface ActivityItem {
  id: string
  user: {
    name: string
    image?: string
    initials: string
  }
  action: string
  target?: string
  timestamp: string
}

export type Activity = ActivityItem

interface ActivityListPropsOriginal {
  title?: string
  items: ActivityItem[]
  className?: string
}

// New simplified activity interface
export interface SimpleActivity {
  id: string
  message: string
  time: string
  type?: "info" | "success" | "warning" | "error"
}

interface ActivityListProps {
  title?: string
  description?: string
  items?: ActivityItem[]
  activities?: SimpleActivity[]
  className?: string
  maxHeight?: string
}

export function ActivityList({
  title = "Recent Activity",
  description,
  items,
  activities,
  className,
  maxHeight = "300px",
}: ActivityListProps) {
  const typeColors = {
    info: "bg-blue-500/10 text-blue-500",
    success: "bg-green-500/10 text-green-500",
    warning: "bg-yellow-500/10 text-yellow-500",
    error: "bg-red-500/10 text-red-500",
  }

  // Use new simplified format if activities is provided
  if (activities) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <ScrollArea className={`pr-4`} style={{ height: maxHeight }}>
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div
                    className={cn(
                      "mt-0.5 h-2 w-2 rounded-full",
                      typeColors[activity.type || "info"]
                    )}
                  />
                  <div className="grid gap-1 flex-1">
                    <p className="text-sm leading-relaxed">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    )
  }

  // Use original format with avatar-based items
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ScrollArea className={`pr-4`} style={{ height: maxHeight }}>
          <div className="space-y-4">
            {(items || []).map((item) => (
              <div key={item.id} className="flex items-start gap-4 text-sm">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={item.user.image} alt={item.user.name} />
                  <AvatarFallback>{item.user.initials}</AvatarFallback>
                </Avatar>
                <div className="grid gap-1">
                  <p className="font-medium leading-none">
                    {item.user.name}{" "}
                    <span className="text-muted-foreground font-normal">{item.action}</span>{" "}
                    {item.target && <span className="font-medium">{item.target}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

// TaskList component
interface TaskItem {
  id: string
  title: string
  description?: string
  count?: number
  priority?: "low" | "medium" | "high"
  href?: string
  actionLabel?: string
  status?: "pending" | "in-progress" | "completed"
  dueDate?: string
}

interface TaskListProps {
  title?: string
  description?: string
  tasks?: TaskItem[]
  items?: TaskItem[]
  emptyMessage?: string
  className?: string
}

export function TaskList({
  title = "Tasks",
  description,
  tasks,
  items,
  emptyMessage = "No tasks",
  className,
}: TaskListProps) {
  const allItems = tasks || items || []

  const priorityColors = {
    low: "text-muted-foreground",
    medium: "text-yellow-500",
    high: "text-red-500",
  }

  const statusColors = {
    pending: "bg-yellow-500/10 text-yellow-500",
    "in-progress": "bg-blue-500/10 text-blue-500",
    completed: "bg-green-500/10 text-green-500",
  }

  if (allItems.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {allItems.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 rounded-lg border p-3"
              >
                <div className="grid gap-1 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium leading-none">{item.title}</p>
                    {item.count !== undefined && item.count > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {item.count}
                      </Badge>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  )}
                  {item.dueDate && (
                    <p className="text-xs text-muted-foreground">Due: {item.dueDate}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item.priority && (
                    <span className={cn("text-xs font-medium", priorityColors[item.priority])}>
                      {item.priority}
                    </span>
                  )}
                  {item.status && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-1 text-xs font-medium",
                        statusColors[item.status]
                      )}
                    >
                      {item.status}
                    </span>
                  )}
                  {item.href && (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={item.href}>{item.actionLabel || "View"}</Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
