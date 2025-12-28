/**
 * Admin Performance Monitoring Page
 * Displays comprehensive database and query performance metrics for Neon PostgreSQL
 */

import { Activity, Database, Shield } from "lucide-react"
import type { Metadata } from "next"
import { Suspense } from "react"
import PerformanceDashboard from "@/components/admin/PerformanceDashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Performance Monitoring | Admin Dashboard",
  description: "Real-time database and query performance monitoring for MedStintClerk",
}

function PerformanceDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>

      {/* Overview Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => ({ id: `overview-card-${i}` })).map((item) => (
          <Card key={item.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mb-2 h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 3 }, (_, i) => ({ id: `content-item-${i}` })).map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Skeleton className="h-5 w-16" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="mb-2 h-4 w-24" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function PerformancePage() {
  return (
    <div className="container mx-auto py-6">
      {/* Page Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center space-x-2">
          <Shield className="h-6 w-6 text-blue-600" />
          <span className="font-medium text-blue-600 text-sm">Admin Dashboard</span>
        </div>
        <div className="flex items-center space-x-2">
          <Database className="h-8 w-8 text-gray-700" />
          <div>
            <h1 className="font-bold text-3xl tracking-tight">Performance Monitoring</h1>
            <p className="text-muted-foreground">
              Real-time insights into database performance, query optimization, and system health
            </p>
          </div>
        </div>
      </div>

      {/* Performance Dashboard */}
      <Suspense fallback={<PerformanceDashboardSkeleton />}>
        <PerformanceDashboard />
      </Suspense>

      {/* Footer Info */}
      <div className="mt-12 border-t pt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>About Performance Monitoring</span>
            </CardTitle>
            <CardDescription>Understanding your database performance metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
              <div>
                <h4 className="mb-2 font-semibold">Query Performance</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Tracks execution times for all database queries</li>
                  <li>• Identifies slow queries (&gt;1 second)</li>
                  <li>• Monitors query patterns and frequency</li>
                  <li>• Provides query optimization recommendations</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">Database Health</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Connection pool status and metrics</li>
                  <li>• Database response time monitoring</li>
                  <li>• Active connection tracking</li>
                  <li>• Resource utilization insights</li>
                </ul>
              </div>
              <div>
                <h4 className="mb-2 font-semibold">Index Analysis</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Index usage statistics and effectiveness</li>
                  <li>• Identifies unused or underutilized indexes</li>
                  <li>• Sequential scan vs index scan ratios</li>
                  <li>• Recommendations for new indexes</li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-muted-foreground text-xs">
                <strong>Note:</strong> Performance data is collected automatically and updated in
                real-time. Slow query threshold is set to 100ms. Data retention is 30 days for
                detailed logs.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
