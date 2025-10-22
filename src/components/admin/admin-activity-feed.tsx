"use client"

import { Activity, AlertCircle, Clock, School, User } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

interface ActivityItem {
  id: string
  type: "user" | "school" | "system" | "security"
  action: string
  description: string
  timestamp: Date
  status: "success" | "warning" | "info" | "error"
  user?: string
  metadata?: Record<string, unknown>
}

interface AdminActivityFeedProps {
  className?: string
  maxHeight?: string
}

export function AdminActivityFeed({ className, maxHeight = "400px" }: AdminActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Mock data - in real app this would come from API
  useEffect(() => {
    const mockActivities: ActivityItem[] = [
      {
        id: "1",
        type: "school",
        action: "School Registered",
        description: "Metro Health Institute has been approved and added to the system",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        status: "success",
        user: "System Admin",
      },
      {
        id: "2",
        type: "system",
        action: "Backup Completed",
        description: "Daily system backup completed successfully with 99.9% integrity",
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        status: "success",
      },
      {
        id: "3",
        type: "security",
        action: "Security Audit",
        description: "Monthly security audit initiated - scanning for vulnerabilities",
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
        status: "info",
      },
      {
        id: "4",
        type: "user",
        action: "User Registration",
        description: "New student account created for Sarah Johnson at Boston Medical",
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
        status: "success",
        user: "Registration System",
      },
      {
        id: "5",
        type: "system",
        action: "Performance Alert",
        description: "Database query response time exceeded 2 seconds - optimization needed",
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        status: "warning",
      },
      {
        id: "6",
        type: "school",
        action: "Site Verification",
        description: "Clinical site verification completed for 3 new locations",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        status: "success",
      },
    ]

    setTimeout(() => {
      setActivities(mockActivities)
      setIsLoading(false)
    }, 1000)
  }, [])

  const _getActivityIcon = (type: ActivityItem["type"], _status: ActivityItem["status"]) => {
    const iconClass = "h-4 w-4"

    switch (type) {
      case "user":
        return <User className={iconClass} />
      case "school":
        return <School className={iconClass} />
      case "security":
        return <AlertCircle className={iconClass} />
      default:
        return <Activity className={iconClass} />
    }
  }

  const getStatusColor = (status: ActivityItem["status"]) => {
    switch (status) {
      case "success":
        return "bg-green-500"
      case "warning":
        return "bg-yellow-500"
      case "error":
        return "bg-red-500"
      default:
        return "bg-blue-500"
    }
  }

  const getBadgeVariant = (
    status: ActivityItem["status"]
  ): "default" | "secondary" | "destructive" | "outline" | "success" => {
    switch (status) {
      case "success":
        return "success"
      case "warning":
        return "secondary"
      case "error":
        return "destructive"
      default:
        return "outline"
    }
  }

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (hours < 1) return "Just now"
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Recent Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['activity-1', 'activity-2', 'activity-3', 'activity-4'].map((key) => (
              <div key={key} className="flex animate-pulse items-start space-x-3">
                <div className="h-8 w-8 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-3 w-1/2 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Recent Activity</span>
        </CardTitle>
        <Button variant="outline" size="sm">
          View All
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className={cn("pr-4", maxHeight)}>
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="group flex items-start space-x-3">
                <div className={cn("mt-1 h-2 w-2 rounded-full", getStatusColor(activity.status))} />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center space-x-2">
                    <Badge variant={getBadgeVariant(activity.status)} className="text-xs">
                      {activity.action}
                    </Badge>
                    <span className="flex items-center space-x-1 text-muted-foreground text-xs">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm">{activity.description}</p>
                  {activity.user && (
                    <p className="text-muted-foreground text-xs">by {activity.user}</p>
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
