"use client"

import {
  Activity,
  AlertCircle,
  CheckCircle,
  Server,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface SystemMetric {
  name: string
  value: number
  max: number
  unit: string
  status: "healthy" | "warning" | "critical"
  trend?: "up" | "down" | "stable"
  trendValue?: number
}

interface ServiceStatus {
  name: string
  status: "operational" | "degraded" | "down"
  uptime: number
  responseTime: number
}

interface SystemStatusProps {
  className?: string
}

export function SystemStatus({ className }: SystemStatusProps) {
  const [metrics, setMetrics] = useState<SystemMetric[]>([])
  const [services, setServices] = useState<ServiceStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Mock data - in real app this would come from monitoring API
    const mockMetrics: SystemMetric[] = [
      {
        name: "CPU Usage",
        value: 42,
        max: 100,
        unit: "%",
        status: "healthy",
        trend: "stable",
      },
      {
        name: "Memory Usage",
        value: 68,
        max: 100,
        unit: "%",
        status: "warning",
        trend: "up",
        trendValue: 5,
      },
      {
        name: "Database Connections",
        value: 156,
        max: 200,
        unit: "",
        status: "healthy",
        trend: "down",
        trendValue: 12,
      },
      {
        name: "Disk Usage",
        value: 78,
        max: 100,
        unit: "%",
        status: "warning",
        trend: "up",
        trendValue: 2,
      },
    ]

    const mockServices: ServiceStatus[] = [
      {
        name: "Web Server",
        status: "operational",
        uptime: 99.9,
        responseTime: 145,
      },
      {
        name: "Database",
        status: "operational",
        uptime: 99.8,
        responseTime: 89,
      },
      {
        name: "API Gateway",
        status: "operational",
        uptime: 99.7,
        responseTime: 203,
      },
      {
        name: "Authentication",
        status: "degraded",
        uptime: 98.5,
        responseTime: 567,
      },
    ]

    setTimeout(() => {
      setMetrics(mockMetrics)
      setServices(mockServices)
      setIsLoading(false)
    }, 1500)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "operational":
        return "text-green-600 bg-green-100 border-green-200"
      case "warning":
      case "degraded":
        return "text-yellow-600 bg-yellow-100 border-yellow-200"
      case "critical":
      case "down":
        return "text-red-600 bg-red-100 border-red-200"
      default:
        return "text-gray-600 bg-gray-100 border-gray-200"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "operational":
        return <CheckCircle className="h-4 w-4" />
      case "warning":
      case "degraded":
        return <AlertCircle className="h-4 w-4" />
      case "critical":
      case "down":
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getTrendIcon = (trend?: string) => {
    if (!trend) return null

    switch (trend) {
      case "up":
        return <TrendingUp className="h-3 w-3 text-red-500" />
      case "down":
        return <TrendingDown className="h-3 w-3 text-green-500" />
      case "stable":
        return <div className="h-3 w-3 rounded-full bg-gray-400" />
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>System Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['skeleton-1', 'skeleton-2', 'skeleton-3', 'skeleton-4'].map((key) => (
              <div key={key} className="animate-pulse">
                <div className="mb-2 flex items-center justify-between">
                  <div className="h-4 w-24 rounded bg-gray-200" />
                  <div className="h-4 w-12 rounded bg-gray-200" />
                </div>
                <div className="h-2 w-full rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("grid gap-6 lg:grid-cols-2", className)}>
      {/* System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>System Metrics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {metrics.map((metric) => (
              <div key={metric.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm">{metric.name}</span>
                    {getTrendIcon(metric.trend)}
                    {metric.trendValue && (
                      <span
                        className={cn(
                          "text-xs",
                          metric.trend === "up" ? "text-red-500" : "text-green-500"
                        )}
                      >
                        {metric.trend === "up" ? "+" : "-"}
                        {metric.trendValue}%
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-xs", getStatusColor(metric.status))}>
                    {getStatusIcon(metric.status)}
                    <span className="ml-1 capitalize">{metric.status}</span>
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <Progress value={(metric.value / metric.max) * 100} className="h-2" />
                  <span className="min-w-[3rem] text-muted-foreground text-xs">
                    {metric.value}
                    {metric.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Service Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full",
                      service.status === "operational"
                        ? "bg-green-500"
                        : service.status === "degraded"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                    )}
                  />
                  <div>
                    <p className="font-medium text-sm">{service.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {service.uptime}% uptime • {service.responseTime}ms
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn("text-xs capitalize", getStatusColor(service.status))}
                >
                  {service.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
