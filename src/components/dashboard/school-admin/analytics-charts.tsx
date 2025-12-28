"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useTheme } from "next-themes"

interface EnrollmentTrendProps {
  data: { month: string; students: number }[]
}

interface SiteCapacityProps {
  data: { name: string; capacity: number; used: number }[]
}

interface CompetencyOverviewProps {
  data: { subject: string; A: number; fullMark: number }[]
}

export function EnrollmentTrendChart({ data }: EnrollmentTrendProps) {
  const { theme } = useTheme()
  const isDark = theme === "dark"

  return (
    <Card className="col-span-4 lg:col-span-2">
      <CardHeader>
        <CardTitle>Enrollment Trends</CardTitle>
        <CardDescription>Student enrollment over the last 7 months</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--medical-primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--medical-primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#333" : "#eee"} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "0.5rem",
              }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Area
              type="monotone"
              dataKey="students"
              stroke="hsl(var(--medical-primary))"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorStudents)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function SiteCapacityChart({ data }: SiteCapacityProps) {
  return (
    <Card className="col-span-4 lg:col-span-2">
      <CardHeader>
        <CardTitle>Clinical Site Capacity</CardTitle>
        <CardDescription>Utilization vs Total Capacity</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "0.5rem",
              }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Bar dataKey="used" stackId="a" fill="hsl(var(--medical-teal))" radius={[0, 0, 0, 0]} barSize={20} />
            <Bar dataKey="capacity" stackId="a" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function CompetencyRadarChart({ data }: CompetencyOverviewProps) {
  return (
    <Card className="col-span-4 lg:col-span-2">
      <CardHeader>
        <CardTitle>Competency Overview</CardTitle>
        <CardDescription>Average student performance by domain</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="subject" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <Radar
              name="Students"
              dataKey="A"
              stroke="hsl(var(--healthcare-green))"
              fill="hsl(var(--healthcare-green))"
              fillOpacity={0.3}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
                borderRadius: "0.5rem",
              }}
              itemStyle={{ color: "hsl(var(--foreground))" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
