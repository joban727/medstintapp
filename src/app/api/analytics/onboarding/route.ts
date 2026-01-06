import { currentUser } from "@clerk/nextjs/server"
import { sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import { cacheIntegrationService } from "@/lib/cache-integration"

// Database row type definitions
interface CompletionRateRow {
  step: string
  users_reached: string | number
  users_completed: string | number
  completion_rate_percent: string | number
}

interface AnalyticsSummaryRow {
  step: string
  event_type: string
  event_count: string | number
  avg_duration_ms: string | number
  min_duration_ms: string | number
  max_duration_ms: string | number
  event_date: string
}

// GET /api/analytics/onboarding - Get onboarding analytics data
export async function GET(_request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      "api:analytics/onboarding/route.ts",
      async () => {
        // Original function logic will be wrapped here
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )

    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn("Cache error in analytics/onboarding/route.ts:", cacheError)
    // Continue with original logic if cache fails
  }

  // Always fall back to original logic if cache miss

  async function executeOriginalLogic() {
    try {
      const user = await currentUser()
      if (!user) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
      }

      // For now, we'll allow any authenticated user to view analytics
      // In production, you might want to restrict this to admin users
      // if (!user.publicMetadata?.role || user.publicMetadata.role !== "ADMIN" as UserRole) {
      //   return NextResponse.json(
      //     { success: false, error: 'Insufficient permissions' },
      //     { status: 403 }
      //   )
      // }

      // Get completion rates from the database view
      const completionRatesResult = await db.execute(
        sql`SELECT * FROM onboarding_completion_rates ORDER BY 
        CASE step
          WHEN 'welcome' THEN 1
          WHEN 'role-selection' THEN 2
          WHEN 'school-selection' THEN 3
          WHEN 'program-selection' THEN 4
          WHEN 'school-setup' THEN 5
          WHEN 'affiliation-setup' THEN 6
          WHEN 'complete' THEN 7
        END`
      )

      // Get analytics summary from the database view
      const analyticsSummaryResult = await db.execute(
        sql`SELECT * FROM onboarding_analytics_summary 
          WHERE event_date >= NOW() - INTERVAL '30 days'
          ORDER BY event_date DESC, step, event_type`
      )

      // Get overall statistics
      const totalUsersResult = await db.execute(
        sql`SELECT COUNT(DISTINCT user_id) as total_users FROM onboarding_sessions`
      )

      const completedUsersResult = await db.execute(
        sql`SELECT COUNT(DISTINCT user_id) as completed_users 
          FROM onboarding_sessions 
          WHERE status = 'completed'`
      )

      const inProgressUsersResult = await db.execute(
        sql`SELECT COUNT(DISTINCT user_id) as in_progress_users 
          FROM onboarding_sessions 
          WHERE status = 'active'`
      )

      const abandonedUsersResult = await db.execute(
        sql`SELECT COUNT(DISTINCT user_id) as abandoned_users 
          FROM onboarding_sessions 
          WHERE status = 'abandoned'`
      )

      // Get average completion time
      const avgCompletionTimeResult = await db.execute(
        sql`SELECT AVG(EXTRACT(EPOCH FROM (updated_at - started_at)) * 1000) as avg_completion_time_ms
          FROM onboarding_sessions 
          WHERE status = 'completed' AND started_at IS NOT NULL`
      )

      // Transform the results
      const completionRates = (completionRatesResult.rows as unknown as CompletionRateRow[]).map(
        (row) => ({
          step: row.step,
          users_reached: Number.parseInt(String(row.users_reached)) || 0,
          users_completed: Number.parseInt(String(row.users_completed)) || 0,
          completion_rate_percent: Number.parseFloat(String(row.completion_rate_percent)) || 0,
        })
      )

      const analyticsSummary = (
        analyticsSummaryResult.rows as unknown as AnalyticsSummaryRow[]
      ).map((row) => ({
        step: row.step,
        event_type: row.event_type,
        event_count: Number.parseInt(String(row.event_count)) || 0,
        avg_duration_ms: Number.parseFloat(String(row.avg_duration_ms)) || 0,
        min_duration_ms: Number.parseFloat(String(row.min_duration_ms)) || 0,
        max_duration_ms: Number.parseFloat(String(row.max_duration_ms)) || 0,
        event_date: row.event_date,
      }))

      const totalUsers = Number.parseInt(String(totalUsersResult.rows[0]?.total_users || "0")) || 0
      const completedUsers =
        Number.parseInt(String(completedUsersResult.rows[0]?.completed_users || "0")) || 0
      const inProgressUsers =
        Number.parseInt(String(inProgressUsersResult.rows[0]?.in_progress_users || "0")) || 0
      const abandonedUsers =
        Number.parseInt(String(abandonedUsersResult.rows[0]?.abandoned_users || "0")) || 0
      const averageCompletionTime =
        Number.parseFloat(String(avgCompletionTimeResult.rows[0]?.avg_completion_time_ms || "0")) ||
        0

      const data = {
        completionRates,
        analyticsSummary,
        totalUsers,
        completedUsers,
        inProgressUsers,
        abandonedUsers,
        averageCompletionTime,
      }

      return NextResponse.json({
        success: true,
        data,
      })
    } catch (error) {
      console.error("Analytics retrieval error:", error)
      return NextResponse.json(
        { success: false, error: "Failed to retrieve analytics data" },
        { status: 500 }
      )
    }
  }

  return await executeOriginalLogic()
}
