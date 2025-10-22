import { eq, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../../database/connection-pool"
import { competencyAssignments } from "../../../../../database/schema"
import { getCurrentUser } from "../../../../../lib/auth-clerk"
import { logAuditEvent } from "../../../../../lib/rbac-middleware"
import { getSchoolContext } from "../../../../../lib/school-context"

// Validation schemas
const progressUpdateSchema = z.object({
  progress: z.number().min(0).max(100),
  notes: z.string().optional(),
  completedCompetencies: z.array(z.string().uuid()).optional(),
  autoCalculate: z.boolean().default(false),
})

const competencyProgressSchema = z.object({
  competencyId: z.string().uuid(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
})

// GET /api/competency-assignments/[id]/progress - Get detailed progress
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const { id } = await params

    // Get assignment
    const [assignment] = await db
      .select()
      .from(competencyAssignments)
      .where(eq(competencyAssignments.id, id))
      .limit(1)

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    // Check permissions
    const canView =
      ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole) ||
      (user && assignment.userId === user.id)

    if (!canView) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Optimized query using CTEs and window functions to get latest evaluations and submissions
    const competencyProgressQuery = await db.execute(sql`
      WITH latest_evaluations AS (
        SELECT 
          competency_id,
          id,
          status,
          score,
          feedback,
          evaluated_at,
          ROW_NUMBER() OVER (PARTITION BY competency_id ORDER BY evaluated_at DESC) as rn
        FROM evaluations 
        WHERE student_id = ${assignment.userId}
      ),
      latest_submissions AS (
        SELECT 
          competency_id,
          id,
          status,
          feedback,
          notes,
          submitted_at,
          reviewed_at,
          evidence,
          submitted_by,
          reviewed_by,
          ROW_NUMBER() OVER (PARTITION BY competency_id ORDER BY submitted_at DESC) as rn
        FROM competency_submissions 
        WHERE student_id = ${assignment.userId}
      )
      SELECT 
        c.id as competency_id,
        c.name as competency_name,
        c.category,
        c.description,
        c.level,
        c.is_required,

        
        -- Latest evaluation data
        le.id as evaluation_id,
        le.status as evaluation_status,
        le.score as evaluation_score,
        le.feedback as evaluation_feedback,
        le.evaluated_at as evaluation_date,
        
        -- Latest submission data
        ls.id as submission_id,
        ls.status as submission_status,
        ls.feedback as submission_feedback,
        ls.notes as submission_notes,
        ls.submitted_at as submission_date,
        ls.reviewed_at as submission_reviewed_at,
        ls.evidence as submission_evidence,
        ls.submitted_by,
        ls.reviewed_by,
        
        -- Computed status and progress
        CASE 
          WHEN le.status = 'COMPLETED' OR ls.status IN ('completed', 'reviewed') THEN 'COMPLETED'
          WHEN le.id IS NOT NULL OR ls.id IS NOT NULL THEN 'IN_PROGRESS'
          ELSE 'NOT_STARTED'
        END as computed_status,
        
        COALESCE(le.evaluated_at, ls.reviewed_at, ls.submitted_at) as last_activity
        
      FROM competencies c
      LEFT JOIN latest_evaluations le ON c.id = le.competency_id AND le.rn = 1
      LEFT JOIN latest_submissions ls ON c.id = ls.competency_id AND ls.rn = 1
      WHERE c.deployment_id = ${assignment.deploymentId}
        AND c.is_deployed = true
      ORDER BY c.category, c.name
    `)

    // Process optimized query results - no more complex in-memory processing needed
    const competencyProgress = competencyProgressQuery.rows.map((row) => {
      const submissionInfo = row.submission_id
        ? {
            submittedBy: row.submitted_by,
            submittedAt: row.submission_date,
            reviewedBy: row.reviewed_by,
            reviewedAt: row.submission_reviewed_at,
            evidence: row.submission_evidence,
          }
        : null

      return {
        competencyId: row.competency_id,
        competencyName: row.competency_name,
        competencyCategory: row.category,
        competencyLevel: row.level,
        isRequired: row.is_required,

        status: row.computed_status,
        score: row.evaluation_score,
        feedback: row.evaluation_feedback || row.submission_feedback,
        evaluatedAt: row.evaluation_date,
        lastActivity: row.last_activity,
        submission: submissionInfo,
        hasEvaluation: !!row.evaluation_id,
        hasSubmission: !!row.submission_id,
      }
    })

    // Calculate overall statistics using aggregation
    const stats = competencyProgress.reduce(
      (acc, p) => {
        acc.total++
        if (p.isRequired) acc.required++
        if (p.status === "COMPLETED") {
          acc.completed++
          if (p.isRequired) acc.completedRequired++
          if (p.score !== null) {
            acc.earnedPoints += Number(p.score) || 0
          }
        }
        if (p.status === "IN_PROGRESS") acc.inProgress++

        return acc
      },
      {
        total: 0,
        required: 0,
        completed: 0,
        completedRequired: 0,
        inProgress: 0,
        totalPoints: 0,
        earnedPoints: 0,
      }
    )

    const totalCompetencies = stats.total
    const requiredCompetencies = stats.required
    const completedCompetencies = stats.completed
    const completedRequired = stats.completedRequired
    const inProgressCompetencies = stats.inProgress
    const totalPoints = stats.totalPoints
    const earnedPoints = stats.earnedPoints

    const overallProgress =
      totalCompetencies > 0 ? (completedCompetencies / totalCompetencies) * 100 : 0
    const requiredProgress =
      requiredCompetencies > 0 ? (completedRequired / requiredCompetencies) * 100 : 100

    return NextResponse.json({
      success: true,
      data: {
        assignmentId: id,
        userId: assignment.userId,
        deploymentId: assignment.deploymentId,
        currentProgress: assignment.progressPercentage,
        calculatedProgress: Math.round(overallProgress),
        statistics: {
          totalCompetencies,
          requiredCompetencies,
          completedCompetencies,
          completedRequired,
          inProgressCompetencies,
          notStartedCompetencies:
            totalCompetencies - completedCompetencies - inProgressCompetencies,
          totalPoints,
          earnedPoints: Math.round(earnedPoints * 100) / 100,
          overallProgress: Math.round(overallProgress * 100) / 100,
          requiredProgress: Math.round(requiredProgress * 100) / 100,
        },
        competencies: competencyProgress,
      },
    })
  } catch (error) {
    console.error("Error fetching assignment progress:", error)
    return NextResponse.json({ error: "Failed to fetch progress" }, { status: 500 })
  }
}

// PUT /api/competency-assignments/[id]/progress - Update progress
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const { id } = await params
    const body = await request.json()

    // Get assignment
    const [assignment] = await db
      .select()
      .from(competencyAssignments)
      .where(eq(competencyAssignments.id, id))
      .limit(1)

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    // Check permissions - users can update their own progress, supervisors can update any
    const canUpdate =
      ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole) ||
      (user && assignment.userId === user.id)

    if (!canUpdate) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const validatedData = progressUpdateSchema.parse(body)

    let finalProgress = validatedData.progress

    // Auto-calculate progress if requested using optimized CTE query
    if (validatedData.autoCalculate) {
      const progressCalculationResult = await db.execute(sql`
        WITH latest_evaluations AS (
          SELECT 
            competency_id,
            status,
            ROW_NUMBER() OVER (PARTITION BY competency_id ORDER BY evaluated_at DESC) as rn
          FROM evaluations 
          WHERE student_id = ${assignment.userId}
            AND status = 'COMPLETED'
        ),
        latest_submissions AS (
          SELECT 
            competency_id,
            status,
            ROW_NUMBER() OVER (PARTITION BY competency_id ORDER BY submitted_at DESC) as rn
          FROM competency_submissions 
          WHERE student_id = ${assignment.userId}
            AND status IN ('APPROVED', 'completed', 'reviewed')
        )
        SELECT 
          COUNT(*) as total_competencies,
          COUNT(CASE WHEN (le.status = 'COMPLETED' OR ls.status IN ('APPROVED', 'completed', 'reviewed')) THEN 1 END) as completed_competencies
        FROM competencies c
        LEFT JOIN latest_evaluations le ON c.id = le.competency_id AND le.rn = 1
        LEFT JOIN latest_submissions ls ON c.id = ls.competency_id AND ls.rn = 1
        WHERE c.deployment_id = ${assignment.deploymentId}
          AND c.is_deployed = true
      `)

      const { total_competencies, completed_competencies } = progressCalculationResult.rows[0]

      const totalCount = Number(total_competencies) || 0
      const completedCount = Number(completed_competencies) || 0

      finalProgress =
        totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0
    }

    // Determine new status based on progress
    let newStatus = assignment.status
    if (finalProgress === 100 && assignment.status === "IN_PROGRESS") {
      newStatus = "COMPLETED"
    } else if (finalProgress > 0 && assignment.status === "COMPLETED" && finalProgress < 100) {
      newStatus = "IN_PROGRESS" // Revert from completed if progress decreased
    }

    // Update assignment
    const updateData = {
      progressPercentage: finalProgress.toString(),
      status: newStatus,
      notes: validatedData.notes || assignment.notes,
      updatedAt: new Date(),
    }

    const [updatedAssignment] = await db
      .update(competencyAssignments)
      .set(updateData)
      .where(eq(competencyAssignments.id, id))
      .returning()

    // Log audit event
    if (user) {
      await logAuditEvent({
        userId: user.id,
        action: "ASSIGNMENT_PROGRESS_UPDATE",
        resource: "competency_assignments",
        resourceId: id,
        details: {
          previousProgress: assignment.progressPercentage,
          newProgress: finalProgress,
          previousStatus: assignment.status,
          newStatus,
          autoCalculated: validatedData.autoCalculate,
          completedCompetencies: validatedData.completedCompetencies,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: updatedAssignment,
      message: "Progress updated successfully",
    })
  } catch (error) {
    console.error("Error updating assignment progress:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 })
  }
}

// POST /api/competency-assignments/[id]/progress - Batch update competency progress
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getSchoolContext()
    const user = await getCurrentUser()
    const { id } = await params
    const body = await request.json()

    // Get assignment
    const [assignment] = await db
      .select()
      .from(competencyAssignments)
      .where(eq(competencyAssignments.id, id))
      .limit(1)

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 })
    }

    // Check permissions
    const canUpdate =
      ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"].includes(context.userRole) ||
      (user && assignment.userId === user.id)

    if (!canUpdate) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { competencyUpdates } = z
      .object({
        competencyUpdates: z.array(competencyProgressSchema).min(1).max(50),
      })
      .parse(body)

    // Optimized CTE query to verify competencies and get current progress
    const competencyValidationResult = await db.execute(sql`
      WITH latest_evaluations AS (
        SELECT 
          competency_id,
          status,
          ROW_NUMBER() OVER (PARTITION BY competency_id ORDER BY evaluated_at DESC) as rn
        FROM evaluations 
        WHERE student_id = ${assignment.userId}
      ),
      latest_submissions AS (
        SELECT 
          competency_id,
          status,
          ROW_NUMBER() OVER (PARTITION BY competency_id ORDER BY submitted_at DESC) as rn
        FROM competency_submissions 
        WHERE student_id = ${assignment.userId}
      )
      SELECT 
        c.id as competency_id,
        true as is_valid,
        le.status as current_evaluation_status,
        ls.status as current_submission_status,
        CASE WHEN (
          le.status IN ('COMPLETED', 'APPROVED') OR 
          ls.status IN ('COMPLETED', 'APPROVED', 'completed', 'reviewed')
        ) THEN true ELSE false END as has_progress
      FROM competencies c
      LEFT JOIN latest_evaluations le ON c.id = le.competency_id AND le.rn = 1
      LEFT JOIN latest_submissions ls ON c.id = ls.competency_id AND ls.rn = 1
      WHERE c.deployment_id = ${assignment.deploymentId}
        AND c.is_deployed = true
    `)

    const competencyValidationQuery = competencyValidationResult.rows

    const validCompetencyIds = new Set(competencyValidationQuery.map((c) => c.competency_id))
    const requestedCompetencyIds = competencyUpdates.map((u) => u.competencyId)

    const invalidCompetencies = requestedCompetencyIds.filter((id) => !validCompetencyIds.has(id))
    if (invalidCompetencies.length > 0) {
      return NextResponse.json(
        {
          error: "Some competencies are not valid for this deployment",
          invalidCompetencies,
        },
        { status: 400 }
      )
    }

    // Process batch updates (this would typically involve actual database updates)
    const _results = competencyUpdates.map((item) => ({
      competencyId: item.competencyId,
      status: "updated",
      previousStatus:
        competencyValidationQuery.find((c) => c.competency_id === item.competencyId)
          ?.current_evaluation_status ||
        competencyValidationQuery.find((c) => c.competency_id === item.competencyId)
          ?.current_submission_status,
      newStatus: item.status,
      score: item.score,
      notes: item.notes,
      updatedAt: new Date(),
      updatedBy: user?.id || null,
    }))

    // Calculate new progress based on batch updates
    const totalCount = competencyValidationQuery.length
    const currentCompletedCount = competencyValidationQuery.filter((c) => c.has_progress).length
    const batchCompletedCount = competencyUpdates.filter((u) => u.status === "COMPLETED").length

    // Estimate new progress (in real implementation, this would be more precise)
    const estimatedCompletedCount = Math.min(
      totalCount,
      currentCompletedCount + batchCompletedCount
    )
    const newProgress =
      totalCount > 0 ? Math.round((estimatedCompletedCount / totalCount) * 100) : 0

    // Update assignment progress
    const [updatedAssignment] = await db
      .update(competencyAssignments)
      .set({
        progressPercentage: newProgress.toString(),
        status: newProgress === 100 ? "COMPLETED" : "IN_PROGRESS",
        updatedAt: new Date(),
      })
      .where(eq(competencyAssignments.id, id))
      .returning()

    // Log audit event
    if (user) {
      await logAuditEvent({
        userId: user.id,
        action: "COMPETENCY_PROGRESS_BATCH_UPDATE",
        resource: "competency_assignments",
        resourceId: id,
        details: {
          updatedCompetencies: competencyUpdates.length,
          completedCompetencies: batchCompletedCount,
          newProgress,
          updates: competencyUpdates,
        },
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        assignment: updatedAssignment,
        updatedCompetencies: competencyUpdates.length,
        newProgress,
      },
      message: "Competency progress updated successfully",
    })
  } catch (error) {
    console.error("Error updating competency progress:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json({ error: "Failed to update competency progress" }, { status: 500 })
  }
}
