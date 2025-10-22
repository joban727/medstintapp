/**
 * Performance Monitoring Dashboard
 * Real-time database and query performance monitoring for Neon PostgreSQL
 */

"use client"

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  Database,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PerformanceMetrics {
  database: {
    health: {
      status: string
      responseTime: number
      pool: {
        totalCount: number
        idleCount: number
        waitingCount: number
      }
    }
    connectionPool: {
      status: string
      responseTime: number
      poolMetrics: {
        totalCount: number
        idleCount: number
        waitingCount: number
        [key: string]: unknown
      }
    }
  }
  queries: {
    summary: {
      totalQueries: number
      averageExecutionTime: number
      slowQueries: number
      slowQueryPercentage: number
      timeRange: string
    }
    slowQueries: Array<{
      query_type: string
      table_name: string
      endpoint: string
      execution_time_ms: number
      rows_examined: number
      rows_returned: number
      created_at: string
      query_sample: string
    }>
    endpointPerformance: Array<{
      endpoint: string
      avgTime: number
      count: number
    }>
  }
  indexes: {
    usage: Array<{
      tablename: string
      indexname: string
      idx_scan: number
      usage_category: string
    }>
    effectiveness: Array<{
      tablename: string
      seq_scan: number
      idx_scan: number
      index_effectiveness: string
    }>
  }
  recommendations: string[]
}

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState("24")

  const fetchMetrics = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    setRefreshing(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/performance?hours=${timeRange}&recommendations=true&indexes=true`
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setMetrics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch metrics")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchMetrics()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => fetchMetrics(false), 30000)
    return () => clearInterval(interval)
  }, [fetchMetrics])

  const _getHealthStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-healthcare-green"
      case "warning":
        return "text-warning"
      case "unhealthy":
        return "text-destructive"
      default:
        return "text-text-muted"
    }
  }

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-healthcare-green" />
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-warning" />
      case "unhealthy":
        return <AlertTriangle className="h-5 w-5 text-destructive" />
      default:
        return <Activity className="h-5 w-5 text-text-muted" />
    }
  }

  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  if (loading && !metrics) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center space-x-3">
          <RefreshCw className="h-6 w-6 animate-spin text-medical-blue" />
          <span className="text-text-secondary text-lg">Loading performance metrics...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="text-text-primary">Error</AlertTitle>
        <AlertDescription className="text-text-secondary">
          Failed to load performance metrics: {error}
          <Button variant="outline" size="sm" className="ml-3" onClick={() => fetchMetrics()}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!metrics) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight text-text-primary">Performance Dashboard</h1>
          <p className="text-text-secondary text-lg">
            Real-time database and query performance monitoring
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="rounded-md border px-3 py-2"
          >
            <option value="1">Last Hour</option>
            <option value="6">Last 6 Hours</option>
            <option value="24">Last 24 Hours</option>
            <option value="168">Last Week</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMetrics(false)}
            disabled={refreshing}
          >
            {refreshing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Database Health</CardTitle>
            {getHealthStatusIcon(metrics.database.health.status)}
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl capitalize">{metrics.database.health.status}</div>
            <p className="text-text-muted text-sm">
              Response: {metrics.database.health.responseTime}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Queries</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {metrics.queries.summary.totalQueries.toLocaleString()}
            </div>
            <p className="text-text-muted text-sm">In {metrics.queries.summary.timeRange}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Avg Query Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {formatExecutionTime(metrics.queries.summary.averageExecutionTime)}
            </div>
            <p className="text-text-muted text-sm">
              {metrics.queries.summary.slowQueryPercentage}% slow queries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Connection Pool</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{metrics.database.health.pool.totalCount}</div>
            <p className="text-text-muted text-sm">
              {metrics.database.health.pool.idleCount} idle,{" "}
              {metrics.database.health.pool.waitingCount} waiting
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      {metrics.recommendations.length > 0 && (
        <Alert className="rounded-xl">
          <TrendingUp className="h-5 w-5 text-medical-blue" />
          <AlertTitle className="text-text-primary">Performance Recommendations</AlertTitle>
          <AlertDescription className="text-text-secondary">
            <ul className="mt-3 list-inside list-disc space-y-2">
              {metrics.recommendations.map((rec, _index) => (
                <li key={`recommendation-${rec.replace(/\s+/g, '-').toLowerCase()}-${rec.length}`} className="text-base">
                  {rec}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Metrics */}
      <Tabs defaultValue="queries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queries">Query Performance</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoint Performance</TabsTrigger>
          <TabsTrigger value="indexes">Index Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="queries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slow Queries</CardTitle>
              <CardDescription>Queries taking longer than 1 second to execute</CardDescription>
            </CardHeader>
            <CardContent>
              {!Array.isArray(metrics.queries.slowQueries) ||
              metrics.queries.slowQueries.length === 0 ? (
                <p className="text-muted-foreground">
                  No slow queries detected in the selected time range.
                </p>
              ) : (
                <div className="space-y-4">
                  {metrics.queries.slowQueries.slice(0, 10).map((query, _index) => (
                    <div key={`slow-query-${query.query_type}-${query.table_name}-${query.execution_time_ms}`} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{query.query_type}</Badge>
                          <Badge variant="secondary">{query.table_name}</Badge>
                          {query.endpoint && <Badge variant="outline">{query.endpoint}</Badge>}
                        </div>
                        <div className="text-muted-foreground text-sm">
                          {formatTimestamp(query.created_at)}
                        </div>
                      </div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-medium text-red-600">
                          {formatExecutionTime(query.execution_time_ms)}
                        </span>
                        <div className="text-muted-foreground text-sm">
                          {query.rows_examined && `${query.rows_examined} examined`}
                          {query.rows_returned && ` → ${query.rows_returned} returned`}
                        </div>
                      </div>
                      {query.query_sample && (
                        <pre className="overflow-x-auto rounded bg-gray-50 p-2 text-xs">
                          {query.query_sample.substring(0, 200)}
                          {query.query_sample.length > 200 && "..."}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Endpoint Performance</CardTitle>
              <CardDescription>Average response times by API endpoint</CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.queries.endpointPerformance.length === 0 ? (
                <p className="text-muted-foreground">No endpoint performance data available.</p>
              ) : (
                <div className="space-y-3">
                  {metrics.queries.endpointPerformance.map((endpoint, _index) => (
                    <div
                      key={`endpoint-${endpoint.endpoint}-${endpoint.count}-${endpoint.avgTime}`}
                      className="flex items-center justify-between rounded border p-3"
                    >
                      <div>
                        <div className="font-medium">{endpoint.endpoint}</div>
                        <div className="text-muted-foreground text-sm">
                          {endpoint.count} queries
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatExecutionTime(endpoint.avgTime)}</div>
                        <div className="text-muted-foreground text-xs">avg response</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indexes" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Index Usage</CardTitle>
                <CardDescription>Most frequently used indexes</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.indexes.usage.length === 0 ? (
                  <p className="text-muted-foreground">No index usage data available.</p>
                ) : (
                  <div className="space-y-2">
                    {metrics.indexes.usage.slice(0, 10).map((index, _i) => (
                      <div key={`index-usage-${index.indexname}-${index.tablename}-${index.idx_scan}`} className="flex items-center justify-between rounded border p-2">
                        <div>
                          <div className="font-medium text-sm">{index.indexname}</div>
                          <div className="text-muted-foreground text-xs">{index.tablename}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant={
                              index.usage_category === "HIGH_USAGE"
                                ? "default"
                                : index.usage_category === "MODERATE_USAGE"
                                  ? "secondary"
                                  : index.usage_category === "LOW_USAGE"
                                    ? "outline"
                                    : "destructive"
                            }
                          >
                            {index.usage_category.replace("_", " ")}
                          </Badge>
                          <span className="text-sm">{index.idx_scan}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Index Effectiveness</CardTitle>
                <CardDescription>Tables with indexing opportunities</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.indexes.effectiveness.length === 0 ? (
                  <p className="text-muted-foreground">No index effectiveness data available.</p>
                ) : (
                  <div className="space-y-2">
                    {metrics.indexes.effectiveness.slice(0, 10).map((table, _i) => (
                      <div key={`index-effectiveness-${table.tablename}-${table.seq_scan}-${table.idx_scan}`} className="flex items-center justify-between rounded border p-2">
                        <div>
                          <div className="font-medium text-sm">{table.tablename}</div>
                          <div className="text-muted-foreground text-xs">
                            {table.seq_scan} seq scans, {table.idx_scan} index scans
                          </div>
                        </div>
                        <Badge
                          variant={
                            table.index_effectiveness === "WELL_INDEXED"
                              ? "default"
                              : table.index_effectiveness === "MODERATE"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {table.index_effectiveness.replace("_", " ")}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
