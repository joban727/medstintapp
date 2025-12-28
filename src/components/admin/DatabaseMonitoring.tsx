import React, { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Database,
  Activity,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
  TrendingUp,
  TrendingDown,
} from "lucide-react"
import {
  performDatabaseHealthCheck,
  getQueryStats,
  getCacheStats,
  clearQueryStats,
  clearCache,
  applyRecommendedIndexes,
} from "@/lib/db-optimization"

interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy"
  metrics: {
    connectionTest: boolean
    queryPerformance: Record<string, any>
    cacheHitRate: number
    testQueryTime: number
    avgQueryTime: number
  }
  error?: string
}

interface QueryStat {
  count: number
  totalTime: number
  average: number
  min: number
  max: number
}

export default function DatabaseMonitoring() {
  const [healthCheck, setHealthCheck] = useState<HealthCheckResult | null>(null)
  const [queryStats, setQueryStats] = useState<Record<string, QueryStat>>({})
  const [cacheStats, setCacheStats] = useState<any>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isApplyingIndexes, setIsApplyingIndexes] = useState(false)
  const [indexResult, setIndexResult] = useState<string | null>(null)

  const fetchMonitoringData = async () => {
    try {
      setIsRefreshing(true)

      // Fetch health check data
      const healthData = await performDatabaseHealthCheck()
      setHealthCheck(healthData as HealthCheckResult)

      // Fetch query statistics
      const stats = getQueryStats()
      setQueryStats(stats)

      // Fetch cache statistics
      const cache = getCacheStats()
      setCacheStats(cache)
    } catch (error) {
      console.error("Error fetching monitoring data:", error)
    } finally {
      setIsRefreshing(false)
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMonitoringData()

    // Set up interval for auto-refresh
    const interval = setInterval(fetchMonitoringData, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const handleApplyIndexes = async () => {
    try {
      setIsApplyingIndexes(true)
      await applyRecommendedIndexes()
      setIndexResult("Database indexes applied successfully")

      // Refresh data after applying indexes
      setTimeout(fetchMonitoringData, 1000)
    } catch (error) {
      setIndexResult(
        `Error applying indexes: ${error instanceof Error ? error.message : "Unknown error"}`
      )
    } finally {
      setIsApplyingIndexes(false)

      // Clear the result message after 5 seconds
      setTimeout(() => setIndexResult(null), 5000)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      case "unhealthy":
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Database className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "healthy":
        return "default"
      case "degraded":
        return "secondary"
      case "unhealthy":
        return "destructive"
      default:
        return "outline"
    }
  }

  const formatTime = (ms: number) => {
    if (ms < 1000) {
      return `${ms.toFixed(2)} ms`
    } else {
      return `${(ms / 1000).toFixed(2)} s`
    }
  }

  const getQueryPerformanceColor = (avgTime: number) => {
    if (avgTime < 100) return "text-green-600"
    if (avgTime < 500) return "text-yellow-600"
    return "text-red-600"
  }

  const getCacheHitRateColor = (hitRate: number) => {
    if (hitRate > 0.8) return "text-green-600"
    if (hitRate > 0.5) return "text-yellow-600"
    return "text-red-600"
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center space-y-2">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading database monitoring data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Database Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor database performance, health, and optimization metrics
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={fetchMonitoringData} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={handleApplyIndexes} disabled={isApplyingIndexes}>
            <Database className="h-4 w-4 mr-2" />
            {isApplyingIndexes ? "Applying..." : "Apply Indexes"}
          </Button>
        </div>
      </div>

      {indexResult && (
        <Alert
          className={
            indexResult.includes("Error")
              ? "border-red-200 bg-red-50"
              : "border-green-200 bg-green-50"
          }
        >
          {indexResult.includes("Error") ? (
            <XCircle className="h-4 w-4 text-red-600" />
          ) : (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )}
          <AlertTitle className={indexResult.includes("Error") ? "text-red-800" : "text-green-800"}>
            {indexResult.includes("Error") ? "Error" : "Success"}
          </AlertTitle>
          <AlertDescription
            className={indexResult.includes("Error") ? "text-red-700" : "text-green-700"}
          >
            {indexResult}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Status</CardTitle>
            {healthCheck && getStatusIcon(healthCheck.status)}
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-bold">
                {healthCheck
                  ? healthCheck.status.charAt(0).toUpperCase() + healthCheck.status.slice(1)
                  : "Unknown"}
              </div>
              {healthCheck && (
                <Badge variant={getStatusBadgeVariant(healthCheck.status) as any}>
                  {healthCheck.status}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Overall database health</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Query Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${healthCheck ? getQueryPerformanceColor(healthCheck.metrics.avgQueryTime) : ""}`}
            >
              {healthCheck ? formatTime(healthCheck.metrics.avgQueryTime) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Average query execution time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${healthCheck ? getCacheHitRateColor(healthCheck.metrics.cacheHitRate) : ""}`}
            >
              {healthCheck ? `${(healthCheck.metrics.cacheHitRate * 100).toFixed(1)}%` : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Query cache effectiveness</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Size</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cacheStats.size || 0} / {cacheStats.maxSize || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Cached queries</p>
            {cacheStats.maxSize && (
              <Progress value={(cacheStats.size / cacheStats.maxSize) * 100} className="mt-2 h-2" />
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="queries">Query Statistics</TabsTrigger>
          <TabsTrigger value="cache">Cache Details</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Performance Metrics</CardTitle>
              <CardDescription>Real-time performance indicators for your database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Connection Test</span>
                    <div className="flex items-center space-x-2">
                      {healthCheck?.metrics.connectionTest ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">Connected</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-600">Disconnected</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Test Query Time</span>
                    <span
                      className={`text-sm font-medium ${healthCheck ? getQueryPerformanceColor(healthCheck.metrics.testQueryTime) : ""}`}
                    >
                      {healthCheck ? formatTime(healthCheck.metrics.testQueryTime) : "N/A"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Average Query Time</span>
                    <span
                      className={`text-sm font-medium ${healthCheck ? getQueryPerformanceColor(healthCheck.metrics.avgQueryTime) : ""}`}
                    >
                      {healthCheck ? formatTime(healthCheck.metrics.avgQueryTime) : "N/A"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cache Hit Rate</span>
                    <span
                      className={`text-sm font-medium ${healthCheck ? getCacheHitRateColor(healthCheck.metrics.cacheHitRate) : ""}`}
                    >
                      {healthCheck
                        ? `${(healthCheck.metrics.cacheHitRate * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cache Size</span>
                    <span className="text-sm font-medium">
                      {cacheStats.size || 0} / {cacheStats.maxSize || 0}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cache Memory Usage</span>
                    <span className="text-sm font-medium">
                      {cacheStats.calculatedSize
                        ? `${(cacheStats.calculatedSize / 1024 / 1024).toFixed(2)} MB`
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {healthCheck?.error && (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="text-red-800">Database Error</AlertTitle>
                  <AlertDescription className="text-red-700">{healthCheck.error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Query Statistics</CardTitle>
              <CardDescription>Performance metrics for database queries</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(queryStats).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(queryStats).map(([query, stats]) => (
                    <div key={query} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm truncate max-w-md">{query}</h4>
                        <Badge variant="outline">{stats.count} executions</Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Avg Time:</span>
                          <span
                            className={`ml-2 font-medium ${getQueryPerformanceColor(stats.average)}`}
                          >
                            {formatTime(stats.average)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Min Time:</span>
                          <span className="ml-2 font-medium">{formatTime(stats.min)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Max Time:</span>
                          <span
                            className={`ml-2 font-medium ${getQueryPerformanceColor(stats.max)}`}
                          >
                            {formatTime(stats.max)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total Time:</span>
                          <span className="ml-2 font-medium">{formatTime(stats.totalTime)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No query statistics available yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Query statistics will appear here as queries are executed
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cache" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cache Details</CardTitle>
              <CardDescription>Information about the query cache</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Current Size</span>
                    <span className="text-sm">{cacheStats.size || 0} items</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Maximum Size</span>
                    <span className="text-sm">{cacheStats.maxSize || 0} items</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Memory Usage</span>
                    <span className="text-sm">
                      {cacheStats.calculatedSize
                        ? `${(cacheStats.calculatedSize / 1024 / 1024).toFixed(2)} MB`
                        : "N/A"}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Hit Rate</span>
                    <span
                      className={`text-sm font-medium ${healthCheck ? getCacheHitRateColor(healthCheck.metrics.cacheHitRate) : ""}`}
                    >
                      {healthCheck
                        ? `${(healthCheck.metrics.cacheHitRate * 100).toFixed(1)}%`
                        : "N/A"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cache TTL</span>
                    <span className="text-sm">5 minutes</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cache Type</span>
                    <span className="text-sm">LRU Cache</span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    clearCache()
                    fetchMonitoringData()
                  }}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Clear Cache
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Database Actions</CardTitle>
              <CardDescription>Perform maintenance and optimization tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Performance Optimization</h4>
                  <p className="text-sm text-muted-foreground">
                    Apply recommended database indexes to improve query performance
                  </p>
                  <Button
                    onClick={handleApplyIndexes}
                    disabled={isApplyingIndexes}
                    className="w-full"
                  >
                    <Database className="h-4 w-4 mr-2" />
                    {isApplyingIndexes ? "Applying..." : "Apply Recommended Indexes"}
                  </Button>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Cache Management</h4>
                  <p className="text-sm text-muted-foreground">
                    Clear the query cache to free up memory
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearCache()
                      fetchMonitoringData()
                    }}
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Clear Query Cache
                  </Button>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Statistics Reset</h4>
                  <p className="text-sm text-muted-foreground">
                    Reset query performance statistics
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearQueryStats()
                      fetchMonitoringData()
                    }}
                    className="w-full"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    Reset Query Statistics
                  </Button>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">Health Check</h4>
                  <p className="text-sm text-muted-foreground">
                    Run a comprehensive database health check
                  </p>
                  <Button
                    variant="outline"
                    onClick={fetchMonitoringData}
                    disabled={isRefreshing}
                    className="w-full"
                  >
                    <Activity className="h-4 w-4 mr-2" />
                    {isRefreshing ? "Checking..." : "Run Health Check"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
