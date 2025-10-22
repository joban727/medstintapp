'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Zap,
  Activity,
  Target,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { OpenMapService } from '@/lib/openmap-service'

interface ChartDataPoint {
  timestamp: Date
  value: number
  label: string
}

interface PerformanceMetrics {
  responseTime: ChartDataPoint[]
  successRate: ChartDataPoint[]
  cacheHitRate: ChartDataPoint[]
  requestVolume: ChartDataPoint[]
}

interface LocationAnalyticsChartProps {
  openMapService?: OpenMapService
  className?: string
  refreshInterval?: number
}

export default function LocationAnalyticsChart({
  openMapService,
  className = '',
  refreshInterval = 30000
}: LocationAnalyticsChartProps) {
  const [service] = useState(() => openMapService || new OpenMapService())
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    responseTime: [],
    successRate: [],
    cacheHitRate: [],
    requestVolume: []
  })
  const [currentMetrics, setCurrentMetrics] = useState(service.getMetrics())
  const [cacheStats, setCacheStats] = useState(service.getCacheStats())
  const [isLoading, setIsLoading] = useState(false)

  // Update metrics
  const updateMetrics = () => {
    const now = new Date()
    const newCurrentMetrics = service.getMetrics()
    const newCacheStats = service.getCacheStats()

    setCurrentMetrics(newCurrentMetrics)
    setCacheStats(newCacheStats)

    // Add new data points to charts
    setMetrics(prev => ({
      responseTime: [
        ...prev.responseTime.slice(-19), // Keep last 20 points
        {
          timestamp: now,
          value: newCurrentMetrics.averageResponseTime,
          label: `${newCurrentMetrics.averageResponseTime.toFixed(0)}ms`
        }
      ],
      successRate: [
        ...prev.successRate.slice(-19),
        {
          timestamp: now,
          value: newCurrentMetrics.totalRequests > 0 
            ? (newCurrentMetrics.successfulRequests / newCurrentMetrics.totalRequests) * 100 
            : 0,
          label: `${newCurrentMetrics.totalRequests > 0 
            ? ((newCurrentMetrics.successfulRequests / newCurrentMetrics.totalRequests) * 100).toFixed(1)
            : 0}%`
        }
      ],
      cacheHitRate: [
        ...prev.cacheHitRate.slice(-19),
        {
          timestamp: now,
          value: newCacheStats.hitRate * 100,
          label: `${(newCacheStats.hitRate * 100).toFixed(1)}%`
        }
      ],
      requestVolume: [
        ...prev.requestVolume.slice(-19),
        {
          timestamp: now,
          value: newCurrentMetrics.totalRequests,
          label: `${newCurrentMetrics.totalRequests}`
        }
      ]
    }))
  }

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(updateMetrics, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  // Initial load
  useEffect(() => {
    updateMetrics()
  }, [])

  // Simple SVG chart component
  const SimpleChart = ({ 
    data, 
    title, 
    color = '#3b82f6',
    height = 200,
    showGrid = true 
  }: {
    data: ChartDataPoint[]
    title: string
    color?: string
    height?: number
    showGrid?: boolean
  }) => {
    if (data.length === 0) {
      return (
        <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
          <div className="text-center">
            <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No data available</p>
          </div>
        </div>
      )
    }

    const maxValue = Math.max(...data.map(d => d.value))
    const minValue = Math.min(...data.map(d => d.value))
    const range = maxValue - minValue || 1

    const svgWidth = 400
    const svgHeight = height
    const padding = 40

    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">{title}</h4>
        <div className="bg-white rounded-lg border p-4">
          <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
            {/* Grid lines */}
            {showGrid && (
              <g opacity="0.2">
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                  <line
                    key={i}
                    x1={padding}
                    y1={padding + (svgHeight - 2 * padding) * ratio}
                    x2={svgWidth - padding}
                    y2={padding + (svgHeight - 2 * padding) * ratio}
                    stroke="#94a3b8"
                    strokeWidth="1"
                  />
                ))}
              </g>
            )}

            {/* Chart line */}
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2"
              points={data.map((point, index) => {
                const x = padding + (index / (data.length - 1)) * (svgWidth - 2 * padding)
                const y = svgHeight - padding - ((point.value - minValue) / range) * (svgHeight - 2 * padding)
                return `${x},${y}`
              }).join(' ')}
            />

            {/* Data points */}
            {data.map((point, index) => {
              const x = padding + (index / (data.length - 1)) * (svgWidth - 2 * padding)
              const y = svgHeight - padding - ((point.value - minValue) / range) * (svgHeight - 2 * padding)
              
              return (
                <g key={index}>
                  <circle
                    cx={x}
                    cy={y}
                    r="3"
                    fill={color}
                    className="hover:r-4 transition-all cursor-pointer"
                  />
                  <title>{`${point.timestamp.toLocaleTimeString()}: ${point.label}`}</title>
                </g>
              )
            })}

            {/* Y-axis labels */}
            {[maxValue, (maxValue + minValue) / 2, minValue].map((value, i) => (
              <text
                key={i}
                x={padding - 10}
                y={padding + (i * (svgHeight - 2 * padding)) / 2 + 5}
                textAnchor="end"
                fontSize="10"
                fill="#6b7280"
              >
                {value.toFixed(0)}
              </text>
            ))}
          </svg>
        </div>
      </div>
    )
  }

  // Performance gauge component
  const PerformanceGauge = ({ 
    value, 
    max, 
    label, 
    color = '#3b82f6',
    size = 120 
  }: {
    value: number
    max: number
    label: string
    color?: string
    size?: number
  }) => {
    const percentage = Math.min((value / max) * 100, 100)
    const radius = size / 2 - 10
    const circumference = 2 * Math.PI * radius
    const strokeDasharray = circumference
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="relative">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#e5e7eb"
              strokeWidth="8"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth="8"
              fill="none"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-bold">{value.toFixed(0)}</div>
              <div className="text-xs text-gray-500">/{max}</div>
            </div>
          </div>
        </div>
        <span className="text-sm font-medium text-center">{label}</span>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Location Analytics</h2>
          <p className="text-muted-foreground">
            Performance metrics and trends for OpenMap API integration
          </p>
        </div>
        <Button
          onClick={updateMetrics}
          disabled={isLoading}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{currentMetrics.totalRequests}</div>
                <p className="text-xs text-muted-foreground">
                  Since {currentMetrics.lastResetTime.toLocaleDateString()}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentMetrics.totalRequests > 0 
                    ? ((currentMetrics.successfulRequests / currentMetrics.totalRequests) * 100).toFixed(1)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {currentMetrics.successfulRequests} successful
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentMetrics.averageResponseTime.toFixed(0)}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  API response time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(cacheStats.hitRate * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {cacheStats.size} cached entries
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Status indicators */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Request Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    Successful
                  </span>
                  <Badge variant="secondary">{currentMetrics.successfulRequests}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <XCircle className="h-3 w-3 text-red-500" />
                    Failed
                  </span>
                  <Badge variant="destructive">{currentMetrics.failedRequests}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    Rate Limited
                  </span>
                  <Badge variant="outline">{currentMetrics.rateLimitHits}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cache Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Hit Rate</span>
                    <span>{(cacheStats.hitRate * 100).toFixed(1)}%</span>
                  </div>
                  <Progress value={cacheStats.hitRate * 100} className="h-2" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Cache Hits</span>
                  <Badge variant="secondary">{currentMetrics.cacheHits}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Cache Misses</span>
                  <Badge variant="outline">{currentMetrics.cacheMisses}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Performance Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <PerformanceGauge
                    value={currentMetrics.totalRequests > 0 
                      ? (currentMetrics.successfulRequests / currentMetrics.totalRequests) * 100 
                      : 0}
                    max={100}
                    label="Overall Score"
                    color={currentMetrics.totalRequests > 0 && 
                           (currentMetrics.successfulRequests / currentMetrics.totalRequests) > 0.9 
                           ? '#10b981' : '#3b82f6'}
                    size={100}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Response Time Distribution</CardTitle>
                <CardDescription>Average API response times over time</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleChart
                  data={metrics.responseTime}
                  title="Response Time (ms)"
                  color="#3b82f6"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Success Rate Trend</CardTitle>
                <CardDescription>API success rate percentage over time</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleChart
                  data={metrics.successRate}
                  title="Success Rate (%)"
                  color="#10b981"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Cache Hit Rate Trend</CardTitle>
                <CardDescription>Cache efficiency over time</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleChart
                  data={metrics.cacheHitRate}
                  title="Cache Hit Rate (%)"
                  color="#8b5cf6"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Request Volume</CardTitle>
                <CardDescription>Total API requests over time</CardDescription>
              </CardHeader>
              <CardContent>
                <SimpleChart
                  data={metrics.requestVolume}
                  title="Total Requests"
                  color="#f59e0b"
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}