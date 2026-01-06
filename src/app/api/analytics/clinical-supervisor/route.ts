import { NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import { sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth-clerk"

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== "CLINICAL_SUPERVISOR") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const timeRange = searchParams.get("timeRange") || "6months"
    const siteId = searchParams.get("siteId")
    const competencyId = searchParams.get("competencyId")

    // Fetch data from materialized views
    // Note: In a real implementation, we would filter by the supervisor's assigned sites/students
    // For now, we'll return school-wide data as a starting point, assuming the supervisor belongs to the school

    // 1. Site Performance
    const sitePerformanceQuery = sql`
      SELECT 
        cs.id,
        cs.name,
        COUNT(DISTINCT u.id) as students,
        COALESCE(AVG(ca.progress_percentage), 0) as avg_score,
        COALESCE(AVG(CASE WHEN ca.status = 'COMPLETED' THEN 100 ELSE 0 END), 0) as pass_rate
      FROM clinical_sites cs
      LEFT JOIN rotations r ON cs.id = r.clinical_site_id
      LEFT JOIN users u ON r.student_id = u.id
      LEFT JOIN competency_assignments ca ON u.id = ca.user_id
      WHERE cs.school_id = ${user.schoolId}
      GROUP BY cs.id, cs.name
    `

    // 2. Competency Data
    const competencyDataQuery = sql`
      SELECT 
        c.id,
        c.name,
        COUNT(CASE WHEN ca.status = 'COMPLETED' THEN 1 END) as completed,
        COUNT(ca.id) as total,
        COALESCE(AVG(ca.progress_percentage), 0) as avg_score
      FROM competencies c
      LEFT JOIN competency_assignments ca ON c.id = ca.competency_id
      LEFT JOIN programs p ON c.program_id = p.id
      WHERE p.school_id = ${user.schoolId}
      GROUP BY c.id, c.name
    `

    const [sitePerformance, competencyData] = await Promise.all([
      db.execute(sitePerformanceQuery),
      db.execute(competencyDataQuery),
    ])

    // Transform data to match frontend expectations
    const formattedSitePerformance = sitePerformance.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      students: Number(row.students),
      avgScore: Math.round(Number(row.avg_score)),
      passRate: Math.round(Number(row.pass_rate)),
    }))

    const formattedCompetencyData = competencyData.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      completed: Number(row.completed),
      total: Number(row.total),
      avgScore: Math.round(Number(row.avg_score)),
    }))

    // Mock predictive insights for now as that requires complex ML/Analysis logic
    const predictiveInsights = [
      {
        id: "1",
        type: "risk",
        title: "Students at Risk of Failure",
        description: "3 students showing early warning signs based on performance patterns",
        confidence: 85,
        action: "Schedule intervention meetings",
      },
      {
        id: "2",
        type: "opportunity",
        title: "High Performers Ready for Advanced Training",
        description: "7 students exceeding expectations and ready for additional challenges",
        confidence: 92,
        action: "Offer advanced rotation opportunities",
      },
      {
        id: "3",
        type: "trend",
        title: "Communication Skills Improvement",
        description: "Overall communication scores trending upward across all sites",
        confidence: 78,
        action: "Continue current training methods",
      },
    ]

    return NextResponse.json({
      sitePerformance: formattedSitePerformance,
      competencyData: formattedCompetencyData,
      predictiveInsights,
    })
  } catch (error) {
    console.error("Analytics API Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
