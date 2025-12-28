"use client"

import { AlertCircle, AlertTriangle, School, Shield, User } from "lucide-react"
import { useEffect, useState } from "react"
import { ActivityList, type Activity as ActivityType } from "@/components/ui/activity-list"
import { formatDistanceToNow } from "date-fns"

interface AdminActivityFeedProps {
  className?: string
  maxHeight?: string
}

export function AdminActivityFeed({ className, maxHeight = "400px" }: AdminActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityType[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchActivities() {
      try {
        const response = await fetch("/api/audit-logs?limit=10")
        if (response.ok) {
          const data = await response.json()
          if (data.success && Array.isArray(data.data)) {
            const mappedActivities: ActivityType[] = data.data.map((log: any) => {
              const type = mapStatusToType(log.status, log.severity)
              return {
                id: log.id,
                message: log.action,
                time: formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }),
                type: type,
                icon: mapIcon(log.resource, type)
              }
            })
            setActivities(mappedActivities)
          }
        }
      } catch (error) {
        console.error("Failed to fetch activities", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchActivities()
  }, [])

  if (isLoading) {
    return (
      <div className={className}>
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6">
          <div className="space-y-2">
            <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
            <div className="h-4 w-2/3 bg-muted animate-pulse rounded" />
            <div className="h-4 w-1/2 bg-muted animate-pulse rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <ActivityList
      title="Recent Activity"
      activities={activities}
      className={className}
      maxHeight={maxHeight}
    />
  )
}

function mapStatusToType(status: string, severity: string): "info" | "success" | "warning" | "error" | "default" {
  if (status === "FAILURE" || status === "ERROR") return "error"
  if (severity === "CRITICAL") return "error"
  if (severity === "HIGH") return "warning"
  if (status === "SUCCESS") return "success"
  return "default"
}

function mapIcon(resource: string, type: string) {
  if (type === "error") return AlertCircle
  if (type === "warning") return AlertTriangle
  if (resource === "users" || resource === "auth") return User
  if (resource === "school") return School
  if (resource === "audit_logs") return Shield
  return undefined
}
