"use client"

import { Activity, Building2, School, TrendingDown, TrendingUp, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface AdminStatsProps {
  totalUsers: number
  totalSchools: number
  totalStudents: number
  activeSessions: number
  userGrowth?: number
  schoolGrowth?: number
  studentGrowth?: number
  sessionGrowth?: number
  className?: string
}

export function AdminStats({
  totalUsers,
  totalSchools,
  totalStudents,
  activeSessions,
  userGrowth = 12,
  schoolGrowth = 2,
  studentGrowth = 8,
  sessionGrowth = 5,
  className,
}: AdminStatsProps) {
  const statItems = [
    {
      title: "Total Users",
      value: totalUsers.toLocaleString(),
      icon: Users,
      growth: userGrowth,
      description: "+12% from last month",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Schools",
      value: totalSchools.toLocaleString(),
      icon: School,
      growth: schoolGrowth,
      description: "+2 new this quarter",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Active Students",
      value: totalStudents.toLocaleString(),
      icon: Building2,
      growth: studentGrowth,
      description: "+8% enrollment growth",
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
    {
      title: "Active Sessions",
      value: activeSessions.toLocaleString(),
      icon: Activity,
      growth: sessionGrowth,
      description: "Current online users",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
  ]

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {statItems.map((item) => {
        const Icon = item.icon
        const isPositive = item.growth >= 0
        const GrowthIcon = isPositive ? TrendingUp : TrendingDown

        if (!Icon) return null

        return (
          <Card
            key={item.title}
            className="group hover:-translate-y-1 transition-all hover:shadow-lg"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-xs sm:text-sm">{item.title}</CardTitle>
              <div className={cn("rounded-lg p-2", item.bgColor)}>
                <Icon className={cn("h-4 w-4", item.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-1 font-bold text-lg sm:text-2xl">{item.value}</div>
              <div className="flex items-center space-x-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    isPositive ? "border-green-200 text-green-600" : "border-red-200 text-red-600"
                  )}
                >
                  <GrowthIcon className="mr-1 h-3 w-3" />
                  {Math.abs(item.growth)}%
                </Badge>
                <p className="text-muted-foreground text-xs">{item.description}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
