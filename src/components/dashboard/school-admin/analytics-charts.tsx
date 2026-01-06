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
  return (
    <Card className="col-span-4 lg:col-span-2 bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
      <CardHeader>
        <CardTitle className="text-white">Enrollment Trends</CardTitle>
        <CardDescription className="text-[var(--text-tertiary)]">
          Student enrollment over the last 7 months
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgb(var(--theme-primary-rgb))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="rgb(var(--theme-primary-rgb))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              stroke="rgba(255,255,255,0.4)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="rgba(255,255,255,0.4)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(20, 20, 20, 0.8)",
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: "0.5rem",
                backdropFilter: "blur(12px)",
                color: "white",
              }}
              itemStyle={{ color: "white" }}
            />
            <Area
              type="monotone"
              dataKey="students"
              stroke="rgb(var(--theme-primary-rgb))"
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
    <Card className="col-span-4 lg:col-span-2 glass-card border-0">
      <CardHeader>
        <CardTitle className="text-white">Clinical Site Capacity</CardTitle>
        <CardDescription className="text-[var(--text-tertiary)]">
          Utilization vs Total Capacity
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              stroke="rgba(255,255,255,0.4)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={100}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{
                backgroundColor: "rgba(20, 20, 20, 0.8)",
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: "0.5rem",
                backdropFilter: "blur(12px)",
                color: "white",
              }}
              itemStyle={{ color: "white" }}
            />
            <Bar
              dataKey="used"
              stackId="a"
              fill="rgb(var(--theme-primary-rgb))"
              radius={[0, 0, 0, 0]}
              barSize={20}
            />
            <Bar
              dataKey="capacity"
              stackId="a"
              fill="rgba(255,255,255,0.1)"
              radius={[0, 4, 4, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function CompetencyRadarChart({ data }: CompetencyOverviewProps) {
  return (
    <Card className="col-span-4 lg:col-span-2 glass-card border-0">
      <CardHeader>
        <CardTitle className="text-white">Competency Overview</CardTitle>
        <CardDescription className="text-[var(--text-tertiary)]">
          Average student performance by domain
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 12 }}
            />
            <Radar
              name="Students"
              dataKey="A"
              stroke="rgb(var(--theme-primary-rgb))"
              fill="rgb(var(--theme-primary-rgb))"
              fillOpacity={0.3}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(20, 20, 20, 0.8)",
                borderColor: "rgba(255,255,255,0.1)",
                borderRadius: "0.5rem",
                backdropFilter: "blur(12px)",
                color: "white",
              }}
              itemStyle={{ color: "white" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
