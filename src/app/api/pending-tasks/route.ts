import { auth } from "@clerk/nextjs/server"
import { eq, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../database/connection-pool"
import { users } from "../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:pending-tasks/route.ts',
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
    console.warn('Cache error in pending-tasks/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user info to determine role and school
    const user = await db
      .select({
        id: users.id,
        role: users.role,
        schoolId: users.schoolId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!user.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const currentUser = user[0]
    const { searchParams } = new URL(request.url)
    const role = searchParams.get("role") || currentUser.role

    let pendingTasks: Array<{
      id: string
      type?: string
      title: string
      description: string
      priority: string
      dueDate?: string
      count?: number
      color?: string
      action?: string
      href?: string
    }> = []

    if (role === "SCHOOL_ADMIN") {
      // Single optimized query using CTEs for all pending task counts
      const result = await db.execute(sql`
        WITH pending_counts AS (
          -- Time record approvals
          SELECT 
            COUNT(*) FILTER (WHERE tr.status = 'PENDING') as time_record_approvals,
            -- Overdue evaluations
            COUNT(*) FILTER (
              WHERE e.overall_rating IS NULL 
              AND r.end_date < CURRENT_DATE
            ) as pending_evaluations,
            -- Rotations needing planning (within 30 days, no preceptor)
            COUNT(*) FILTER (
              WHERE r.preceptor_id IS NULL 
              AND r.start_date >= CURRENT_DATE 
              AND r.start_date <= CURRENT_DATE + INTERVAL '30 days'
            ) as upcoming_rotations
          FROM users u
          LEFT JOIN time_records tr ON tr.student_id = u.id AND u.school_id = ${currentUser.schoolId}
          LEFT JOIN rotations r ON r.student_id = u.id AND u.school_id = ${currentUser.schoolId}
          LEFT JOIN evaluations e ON e.rotation_id = r.id
          WHERE u.school_id = ${currentUser.schoolId}
        )
        SELECT * FROM pending_counts
      `)

      const counts = result.rows[0] || {
        time_record_approvals: 0,
        pending_evaluations: 0,
        upcoming_rotations: 0,
      }

      pendingTasks = [
        {
          id: "time-record-approvals",
          title: "Time Record Approvals",
          description: `${counts.time_record_approvals || 0} pending approvals`,
          count: Number(counts.time_record_approvals) || 0,
          priority: "high",
          color: "yellow",
          action: "Review",
          href: "/dashboard/school-admin/time-records",
        },
        {
          id: "student-evaluations",
          title: "Student Evaluations",
          description: `${counts.pending_evaluations || 0} evaluations due`,
          count: Number(counts.pending_evaluations) || 0,
          priority: "medium",
          color: "blue",
          action: "Complete",
          href: "/dashboard/school-admin/evaluations",
        },
        {
          id: "rotation-planning",
          title: "Rotation Planning",
          description: `${counts.upcoming_rotations || 0} rotations need preceptors`,
          count: Number(counts.upcoming_rotations) || 0,
          priority: "low",
          color: "green",
          action: "Plan",
          href: "/dashboard/school-admin/rotations",
        },
      ]
    } else if (role === "CLINICAL_PRECEPTOR") {
      // Single optimized query using CTEs for all pending task counts
      const result = await db.execute(sql`
        WITH preceptor_counts AS (
          SELECT 
            -- Time records assigned to this preceptor for review
            COUNT(*) FILTER (
              WHERE tr.status = 'PENDING' 
              AND r.preceptor_id = ${currentUser.id}
            ) as time_record_reviews,
            -- Evaluations this preceptor needs to complete
            COUNT(*) FILTER (
              WHERE e.overall_rating IS NULL 
              AND r.end_date <= CURRENT_DATE 
              AND r.preceptor_id = ${currentUser.id}
            ) as pending_evaluations,
            -- Messages (placeholder for future implementation)
            0 as unread_messages
          FROM rotations r
          LEFT JOIN time_records tr ON tr.rotation_id = r.id
          LEFT JOIN evaluations e ON e.rotation_id = r.id
          WHERE r.preceptor_id = ${currentUser.id}
        )
        SELECT * FROM preceptor_counts
      `)

      const counts = result.rows[0] || {
        time_record_reviews: 0,
        pending_evaluations: 0,
        unread_messages: 0,
      }

      pendingTasks = [
        {
          id: "time-record-reviews",
          title: "Time Record Reviews",
          description: `${counts.time_record_reviews || 0} pending approvals`,
          count: Number(counts.time_record_reviews) || 0,
          priority: "high",
          color: "yellow",
          action: "Review",
          href: "/dashboard/clinical-preceptor/time-records",
        },
        {
          id: "student-evaluations",
          title: "Student Evaluations",
          description: `${counts.pending_evaluations || 0} evaluations due`,
          count: Number(counts.pending_evaluations) || 0,
          priority: "medium",
          color: "blue",
          action: "Complete",
          href: "/dashboard/clinical-preceptor/evaluations",
        },
        {
          id: "messages",
          title: "Messages",
          description: `${counts.unread_messages || 0} unread messages`,
          count: Number(counts.unread_messages) || 0,
          priority: "low",
          color: "green",
          action: "Read",
          href: "/dashboard/clinical-preceptor/messages",
        },
      ]
    } else {
      // For other roles, return empty tasks
      pendingTasks = []
    }

    return NextResponse.json({
      success: true,
      tasks: pendingTasks,
      role: currentUser.role,
    })
  } catch (error) {
    console.error("Error fetching pending tasks:", error)
    return NextResponse.json({ error: "Failed to fetch pending tasks" }, { status: 500 })
  }

  }
}
