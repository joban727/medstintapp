'use client'

import type React from 'react'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Calendar,
  Target,
  Activity,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { cn } from '@/lib/utils'

interface TimeRecord {
  id: string
  date: string
  totalHours: number | null
  status: string
  rotation: {
    name: string
    specialty: string
  }
  activities?: string[]
}

interface WeeklyHoursData {
  week: string
  hours: number
  target: number
  day: string
}

interface DailyHoursData {
  date: string
  hours: number
  activities: number
  status: string
}

interface RotationHoursData {
  rotation: string
  hours: number
  target: number
  percentage: number
  specialty: string
}

interface ActivityBreakdownData {
  activity: string
  hours: number
  percentage: number
}

interface ClinicalHoursAnalyticsProps {
  timeRecords?: TimeRecord[]
  totalHours?: number
  weeklyTarget?: number
  className?: string
  onRefresh?: () => void
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export function ClinicalHoursAnalytics({ 
  timeRecords = [], 
  totalHours = 0, 
  weeklyTarget = 40,
  className,
  onRefresh 
}: ClinicalHoursAnalyticsProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'rotation'>('week')
  const [selectedRotation, setSelectedRotation] = useState<string>('all')
  const [isLoading, setIsLoading] = useState(false)
  const [expandedChart, setExpandedChart] = useState<string | null>(null)

  // Generate sample data for demonstration
  const generateWeeklyData = (): WeeklyHoursData[] => {
    const data: WeeklyHoursData[] = []
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    
    for (let i = 0; i < 7; i++) {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      
      data.push({
        week: days[i],
        hours: Math.floor(Math.random() * 12) + 2, // 2-14 hours
        target: weeklyTarget / 5, // Daily target based on 5-day week
        day: date.toISOString().split('T')[0]
      })
    }
    
    return data
  }

  const generateDailyData = (): DailyHoursData[] => {
    const data: DailyHoursData[] = []
    
    for (let i = 0; i < 30; i++) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      
      data.push({
        date: date.toISOString().split('T')[0],
        hours: Math.floor(Math.random() * 10) + 1,
        activities: Math.floor(Math.random() * 8) + 1,
        status: Math.random() > 0.8 ? 'pending' : 'approved'
      })
    }
    
    return data.reverse()
  }

  const generateRotationData = (): RotationHoursData[] => {
    const rotations = [
      { name: 'Internal Medicine', specialty: 'Medicine', target: 160 },
      { name: 'Surgery', specialty: 'Surgery', target: 120 },
      { name: 'Pediatrics', specialty: 'Pediatrics', target: 80 },
      { name: 'Emergency Medicine', specialty: 'Emergency', target: 60 },
      { name: 'Psychiatry', specialty: 'Psychiatry', target: 40 }
    ]
    
    return rotations.map(rotation => {
      const hours = Math.floor(Math.random() * rotation.target * 0.8) + (rotation.target * 0.2)
      return {
        rotation: rotation.name,
        hours,
        target: rotation.target,
        percentage: Math.round((hours / rotation.target) * 100),
        specialty: rotation.specialty
      }
    })
  }

  const generateActivityData = (): ActivityBreakdownData[] => {
    const activities = [
      'Patient Care', 'Documentation', 'Procedures', 'Meetings', 'Education', 'Other'
    ]
    
    const total = totalHours || 100
    let remaining = total
    
    return activities.map((activity, index) => {
      const isLast = index === activities.length - 1
      const hours = isLast ? remaining : Math.floor(Math.random() * remaining * 0.4)
      remaining -= hours
      
      return {
        activity,
        hours,
        percentage: Math.round((hours / total) * 100)
      }
    })
  }

  const [weeklyData, setWeeklyData] = useState<WeeklyHoursData[]>([])
  const [dailyData, setDailyData] = useState<DailyHoursData[]>([])
  const [rotationData, setRotationData] = useState<RotationHoursData[]>([])
  const [activityData, setActivityData] = useState<ActivityBreakdownData[]>([])

  useEffect(() => {
    setWeeklyData(generateWeeklyData())
    setDailyData(generateDailyData())
    setRotationData(generateRotationData())
    setActivityData(generateActivityData())
  }, [totalHours, weeklyTarget])

  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      if (onRefresh) {
        await onRefresh()
      }
      // Regenerate data
      setWeeklyData(generateWeeklyData())
      setDailyData(generateDailyData())
      setRotationData(generateRotationData())
      setActivityData(generateActivityData())
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value} hours
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{data.activity}</p>
          <p>{data.hours} hours ({data.percentage}%)</p>
        </div>
      )
    }
    return null
  }

  const ChartCard = ({ 
    title, 
    description, 
    children, 
    chartKey,
    className 
  }: { 
    title: string
    description?: string
    children: React.ReactNode
    chartKey: string
    className?: string
  }) => {
    const isExpanded = expandedChart === chartKey
    
    return (
      <Card className={cn("transition-all duration-300", className, isExpanded && "col-span-full")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && (
                <CardDescription className="text-sm">{description}</CardDescription>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedChart(isExpanded ? null : chartKey)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className={cn("pt-0", isExpanded && "h-96")}>
          {children}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Clinical Hours Analytics</h2>
          <p className="text-muted-foreground">
            Track your clinical hours progress and performance trends
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Timeframe Selector */}
      <div className="flex items-center gap-2">
        <Badge variant="outline">Timeframe:</Badge>
        <Tabs value={selectedTimeframe} onValueChange={(value) => setSelectedTimeframe(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="week">Weekly</TabsTrigger>
            <TabsTrigger value="month">Monthly</TabsTrigger>
            <TabsTrigger value="rotation">Rotation</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Weekly Hours Chart */}
        <ChartCard 
          title="Weekly Hours" 
          description="Daily hours vs target"
          chartKey="weekly"
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="hours" fill="#3b82f6" name="Actual Hours" />
              <Bar dataKey="target" fill="#e5e7eb" name="Target Hours" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Daily Trend Chart */}
        <ChartCard 
          title="Daily Trend" 
          description="Hours tracked over time"
          chartKey="daily"
        >
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString()} />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="hours" 
                stroke="#10b981" 
                strokeWidth={2}
                name="Hours"
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Activity Breakdown */}
        <ChartCard 
          title="Activity Breakdown" 
          description="Hours by activity type"
          chartKey="activity"
        >
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={activityData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={5}
                dataKey="hours"
              >
                {activityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {activityData.map((item, index) => (
              <div key={item.activity} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span>{item.activity}</span>
                </div>
                <span className="font-medium">{item.hours}h</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Rotation Progress */}
        <ChartCard 
          title="Rotation Progress" 
          description="Hours by rotation"
          chartKey="rotation"
          className="md:col-span-2"
        >
          <div className="space-y-4">
            {rotationData.map((rotation) => (
              <div key={rotation.rotation} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{rotation.rotation}</span>
                  <span className="text-muted-foreground">
                    {rotation.hours}/{rotation.target} hours
                  </span>
                </div>
                <Progress value={rotation.percentage} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{rotation.percentage}% complete</span>
                  <span>{rotation.specialty}</span>
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Summary Stats */}
        <ChartCard 
          title="Summary Statistics" 
          description="Key performance metrics"
          chartKey="summary"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium">Total Hours</p>
                  <p className="text-xs text-muted-foreground">All rotations</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600">{totalHours}</p>
                <p className="text-xs text-muted-foreground">hours</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium">Weekly Target</p>
                  <p className="text-xs text-muted-foreground">Current week</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">{weeklyTarget}</p>
                <p className="text-xs text-muted-foreground">hours/week</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="text-sm font-medium">Avg Daily Hours</p>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-amber-600">
                  {weeklyData.length > 0 ? Math.round(weeklyData.reduce((sum, day) => sum + day.hours, 0) / 7 * 10) / 10 : 0}
                </p>
                <p className="text-xs text-muted-foreground">hours/day</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">Completion Rate</p>
                  <p className="text-xs text-muted-foreground">Overall progress</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-purple-600">
                  {rotationData.length > 0 ? Math.round(rotationData.reduce((sum, rot) => sum + rot.percentage, 0) / rotationData.length) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">average</p>
              </div>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

export function ClinicalHoursAnalyticsMobile({ 
  timeRecords = [], 
  totalHours = 0, 
  weeklyTarget = 40,
  className,
  onRefresh 
}: ClinicalHoursAnalyticsProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'week' | 'month' | 'rotation'>('week')
  const [isLoading, setIsLoading] = useState(false)

  // Generate sample data for mobile
  const generateMobileWeeklyData = () => {
    return [
      { day: 'Mon', hours: 8.5, target: 8 },
      { day: 'Tue', hours: 7.2, target: 8 },
      { day: 'Wed', hours: 9.1, target: 8 },
      { day: 'Thu', hours: 6.8, target: 8 },
      { day: 'Fri', hours: 8.3, target: 8 },
      { day: 'Sat', hours: 0, target: 0 },
      { day: 'Sun', hours: 0, target: 0 }
    ]
  }

  const generateMobileSummary = () => {
    return [
      { label: 'This Week', value: '47.9h', change: '+2.3h', trend: 'up' },
      { label: 'This Month', value: '198.5h', change: '+15.2h', trend: 'up' },
      { label: 'Total Hours', value: `${totalHours}h`, change: null, trend: 'stable' },
      { label: 'Completion', value: '78%', change: '+5%', trend: 'up' }
    ]
  }

  const [weeklyData] = useState(generateMobileWeeklyData())
  const [summaryData] = useState(generateMobileSummary())

  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      if (onRefresh) {
        await onRefresh()
      }
    } catch (error) {
      console.error('Error refreshing data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Hours Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Track your clinical progress
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={isLoading}
          className="h-8"
        >
          <RefreshCw className={cn("h-3 w-3 mr-1", isLoading && "animate-spin")} />
          <span className="text-xs">Refresh</span>
        </Button>
      </div>

      {/* Timeframe Selector */}
      <Tabs value={selectedTimeframe} onValueChange={(value) => setSelectedTimeframe(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="week" className="text-xs">Week</TabsTrigger>
          <TabsTrigger value="month" className="text-xs">Month</TabsTrigger>
          <TabsTrigger value="rotation" className="text-xs">Rotation</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        {summaryData.map((item, index) => (
          <Card key={index} className="p-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-lg font-bold">{item.value}</p>
              {item.change && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-xs text-green-500">{item.change}</span>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Weekly Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Weekly Hours</CardTitle>
          <CardDescription className="text-xs">Daily breakdown</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                formatter={(value: any) => [`${value}h`, 'Hours']}
                labelFormatter={(label) => `${label}`}
              />
              <Bar dataKey="hours" fill="#3b82f6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span className="text-sm">Target Hours</span>
              </div>
              <span className="text-sm font-medium">{weeklyTarget}/week</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm">Avg Daily</span>
              </div>
              <span className="text-sm font-medium">6.8h/day</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-sm">This Week</span>
              </div>
              <span className="text-sm font-medium">47.9h</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}