"use server"

import { and, count, desc, eq, gte, isNull, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { db } from "@/database/connection-pool"
import {
  assessments,
  clinicalSites,
  competencies,
  evaluations,
  rotations,
  timeRecords,
  users,
} from "../../database/schema"
import { getCurrentUser as getClerkUser } from "../../lib/auth-clerk"

// Type definitions
interface TimeRecord {
  id: string
  date: string
  clockIn: string | null
  clockOut: string | null
  totalHours: number | null
  status: string
  activities: string | null
}

interface CompetencyProgress {
  competencyId: string
  competencyName: string
  category: string
  level: string
  isRequired: boolean
  latestScore: number | null
  maxScore: number | null
  passed: boolean
  assessmentDate: string | null
}

// Helper function to get current user
async function getCurrentUser() {
  const user = await getClerkUser()
  if (!user?.id) {
    redirect("/auth/sign-in")
  }
  return user
}

// Student Dashboard Actions
export async function getStudentDashboardData(studentId: string) {
  try {
    // Validate studentId
    if (!studentId || typeof studentId !== "string") {
      throw new Error("Invalid student ID provided")
    }

    // Add timeout wrapper to prevent hanging queries
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Dashboard data fetch timeout")), 10000) // 10 second timeout
    })

    const dataFetchPromise = (async () => {
      // Get student profile with comprehensive error handling
      let student = null
      try {
        const studentResult = await db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            schoolId: users.schoolId,
            programId: users.programId,
            studentId: users.studentId,
            totalClinicalHours: users.totalClinicalHours,
            completedRotations: users.completedRotations,
            isActive: users.isActive,
          })
          .from(users)
          .where(eq(users.id, studentId))
          .limit(1)

        student = studentResult?.[0] || null
      } catch (error) {
        console.error("Error fetching student profile:", error)
        student = null
      }

      // Get current rotation with safe joins
      let currentRotation = null
      try {
        const rotationResult = await db
          .select({
            id: rotations.id,
            specialty: rotations.specialty,
            startDate: rotations.startDate,
            endDate: rotations.endDate,
            requiredHours: rotations.requiredHours,
            completedHours: rotations.completedHours,
            status: rotations.status,
            clinicalSiteName: clinicalSites.name,
            clinicalSiteAddress: clinicalSites.address,
            clinicalSiteType: clinicalSites.type,
          })
          .from(rotations)
          .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
          .where(and(eq(rotations.studentId, studentId), eq(rotations.status, "ACTIVE")))
          .limit(1)

        const rotation = rotationResult?.[0]
        if (rotation) {
          currentRotation = {
            ...rotation,
            clinicalSite: {
              name: rotation.clinicalSiteName || "Unknown Site",
              address: rotation.clinicalSiteAddress || "Unknown Address",
              type: rotation.clinicalSiteType || "Unknown Type",
            },
          }
        }
      } catch (error) {
        console.error("Error fetching current rotation:", error)
        currentRotation = null
      }

      // Get recent time records with safe data handling
      let recentTimeRecords: TimeRecord[] = []
      try {
        const timeRecordsResult = await db
          .select({
            id: timeRecords.id,
            date: timeRecords.date,
            clockIn: timeRecords.clockIn,
            clockOut: timeRecords.clockOut,
            totalHours: timeRecords.totalHours,
            status: timeRecords.status,
            activities: timeRecords.activities,
          })
          .from(timeRecords)
          .where(eq(timeRecords.studentId, studentId))
          .orderBy(desc(timeRecords.date))
          .limit(5)

        // Filter and validate time records, converting Date objects to strings
        recentTimeRecords = (timeRecordsResult || [])
          .filter((record) => record?.id && record.date)
          .map((record) => ({
            id: record.id,
            date:
              record.date instanceof Date ? record.date.toISOString().split("T")[0] : record.date,
            clockIn: record.clockIn?.toISOString() || null,
            clockOut: record.clockOut?.toISOString() || null,
            totalHours: record.totalHours ? Number.parseFloat(record.totalHours) : null,
            status: record.status,
            activities: record.activities || null,
          }))
      } catch (error) {
        console.error("Error fetching time records:", error)
        recentTimeRecords = []
      }

      // Get total clinical hours with safe aggregation
      let totalClinicalHours = "0"
      try {
        const totalHoursResult = await db
          .select({
            total: sql<number>`COALESCE(SUM(CAST(${timeRecords.totalHours} AS NUMERIC)), 0)`,
          })
          .from(timeRecords)
          .where(and(eq(timeRecords.studentId, studentId), eq(timeRecords.status, "APPROVED")))

        totalClinicalHours = totalHoursResult?.[0]?.total?.toString() || "0"
      } catch (error) {
        console.error("Error fetching total hours:", error)
        totalClinicalHours = "0"
      }

      // Get weekly hours change (hours from the last 7 days)
      let weeklyHoursChange = "0"
      try {
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

        const weeklyHoursResult = await db
          .select({
            total: sql<number>`COALESCE(SUM(CAST(${timeRecords.totalHours} AS NUMERIC)), 0)`,
          })
          .from(timeRecords)
          .where(
            and(
              eq(timeRecords.studentId, studentId),
              eq(timeRecords.status, "APPROVED"),
              gte(timeRecords.date, oneWeekAgo)
            )
          )

        const weeklyTotal = weeklyHoursResult?.[0]?.total?.toString() || "0"
        weeklyHoursChange = weeklyTotal === "0" ? "0" : `+${weeklyTotal}`
      } catch (error) {
        console.error("Error fetching weekly hours:", error)
        weeklyHoursChange = "0"
      }

      // Get competency progress with comprehensive null handling
      let competencyProgress: CompetencyProgress[] = []
      try {
        const rawCompetencyProgress = await db
          .select({
            competencyId: competencies.id,
            competencyName: competencies.name,
            category: competencies.category,
            level: competencies.level,
            isRequired: competencies.isRequired,
            latestScore: assessments.score,
            maxScore: assessments.maxScore,
            passed: assessments.passed,
            assessmentDate: assessments.date,
          })
          .from(competencies)
          .leftJoin(
            assessments,
            and(eq(assessments.competencyId, competencies.id), eq(assessments.studentId, studentId))
          )
          .orderBy(competencies.category, competencies.name)

        // Safely process competency data with null checks
        competencyProgress = (rawCompetencyProgress || [])
          .map((comp) => {
            if (!comp || !comp.competencyId || !comp.competencyName) {
              return null
            }

            return {
              competencyId: comp.competencyId,
              competencyName: comp.competencyName,
              category: comp.category || "Uncategorized",
              level: comp.level || "FUNDAMENTAL",
              isRequired: comp.isRequired || false,
              latestScore: comp.latestScore ? Number.parseFloat(comp.latestScore) : null,
              maxScore: comp.maxScore ? Number.parseFloat(comp.maxScore) : null,
              passed: comp.passed || false,
              assessmentDate: comp.assessmentDate
                ? comp.assessmentDate.toISOString().split("T")[0]
                : null,
            }
          })
          .filter((comp) => comp !== null)
      } catch (error) {
        console.error("Error fetching competency progress:", error)
        competencyProgress = []
      }

      // Get evaluations data with safe aggregation
      let evaluationsData = { total: 0, pending: 0 }
      try {
        const [totalEvaluations, pendingEvaluations] = await Promise.all([
          // Total evaluations for this student
          db
            .select({ count: count() })
            .from(evaluations)
            .where(eq(evaluations.studentId, studentId)),

          // Pending evaluations (not completed)
          db
            .select({ count: count() })
            .from(evaluations)
            .where(and(eq(evaluations.studentId, studentId), isNull(evaluations.overallRating))),
        ])

        evaluationsData = {
          total: totalEvaluations[0]?.count || 0,
          pending: pendingEvaluations[0]?.count || 0,
        }
      } catch (error) {
        console.error("Error fetching evaluations data:", error)
        evaluationsData = { total: 0, pending: 0 }
      }

      // Return safe, validated data structure
      return {
        student: student,
        currentRotation: currentRotation,
        recentTimeRecords: recentTimeRecords,
        totalClinicalHours: totalClinicalHours,
        weeklyHoursChange: weeklyHoursChange,
        competencyProgress: competencyProgress,
        evaluationsData: evaluationsData,
      }
    })()

    // Race between data fetch and timeout
    return await Promise.race([dataFetchPromise, timeoutPromise])
  } catch (error) {
    console.error("Critical error in getStudentDashboardData:", error)
    // Return completely safe fallback data
    return {
      student: null,
      currentRotation: null,
      recentTimeRecords: [],
      totalClinicalHours: "0",
      weeklyHoursChange: "0",
      competencyProgress: [],
      evaluationsData: { total: 0, pending: 0 },
    }
  }
}

// Time Record Actions
export async function clockIn(rotationId: string, activities: string[]) {
  try {
    const response = await fetch("/api/time-records/clock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "clock-in",
        rotationId,
        activities,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Failed to clock in")
    }

    revalidatePath("/dashboard/student")
    return { success: true, timeRecord: result.data }
  } catch (error) {
    console.error("Error clocking in:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to clock in" }
  }
}

export async function clockOut(timeRecordId: string, notes?: string) {
  try {
    const response = await fetch("/api/time-records/clock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "clock-out",
        timeRecordId,
        notes,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Failed to clock out")
    }

    revalidatePath("/dashboard/student")
    return { success: true, timeRecord: result.data }
  } catch (error) {
    console.error("Error clocking out:", error)
    return { success: false, error: error instanceof Error ? error.message : "Failed to clock out" }
  }
}

// Rotation Actions
export async function getStudentRotations(studentId: string) {
  try {
    const rotationsList = await db
      .select({
        id: rotations.id,
        specialty: rotations.specialty,
        startDate: rotations.startDate,
        endDate: rotations.endDate,
        requiredHours: rotations.requiredHours,
        completedHours: rotations.completedHours,
        status: rotations.status,
        clinicalSite: {
          name: clinicalSites.name,
          address: clinicalSites.address,
          type: clinicalSites.type,
        },
      })
      .from(rotations)
      .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
      .where(eq(rotations.studentId, studentId))
      .orderBy(desc(rotations.startDate))

    return rotationsList
  } catch (error) {
    console.error("Error fetching rotations:", error)
    throw new Error("Failed to fetch rotations")
  }
}

// Assessment Actions
export async function getStudentAssessments(studentId: string) {
  try {
    const assessmentsList = await db
      .select({
        id: assessments.id,
        date: assessments.date,
        score: assessments.score,
        maxScore: assessments.maxScore,
        passed: assessments.passed,
        notes: assessments.feedback,
        competency: {
          name: competencies.name,
          category: competencies.category,
          level: competencies.level,
        },
      })
      .from(assessments)
      .leftJoin(competencies, eq(assessments.competencyId, competencies.id))
      .where(eq(assessments.studentId, studentId))
      .orderBy(desc(assessments.date))

    return assessmentsList
  } catch (error) {
    console.error("Error fetching assessments:", error)
    throw new Error("Failed to fetch assessments")
  }
}

// Time Records Actions
export async function getTimeRecords(studentId: string, rotationId?: string) {
  try {
    const conditions = [eq(timeRecords.studentId, studentId)]
    if (rotationId) {
      conditions.push(eq(timeRecords.rotationId, rotationId))
    }

    const records = await db
      .select({
        id: timeRecords.id,
        date: timeRecords.date,
        clockIn: timeRecords.clockIn,
        clockOut: timeRecords.clockOut,
        totalHours: timeRecords.totalHours,
        activities: timeRecords.activities,
        notes: timeRecords.notes,
        status: timeRecords.status,
        rotation: {
          id: rotations.id,
          specialty: rotations.specialty,
          clinicalSite: clinicalSites.name,
        },
      })
      .from(timeRecords)
      .leftJoin(rotations, eq(timeRecords.rotationId, rotations.id))
      .leftJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
      .where(and(...conditions))
      .orderBy(desc(timeRecords.date))

    return records
  } catch (error) {
    console.error("Error fetching time records:", error)
    throw new Error("Failed to fetch time records")
  }
}

// Update time record
export async function updateTimeRecord(
  timeRecordId: string,
  data: {
    activities?: string[]
    notes?: string
  }
) {
  try {
    const user = await getCurrentUser()

    const updateData: {
      updatedAt: Date
      activities?: string
      notes?: string
    } = {
      updatedAt: new Date(),
    }

    if (data.activities) {
      updateData.activities = JSON.stringify(data.activities)
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes
    }

    const updatedRecord = await db
      .update(timeRecords)
      .set(updateData)
      .where(and(eq(timeRecords.id, timeRecordId), eq(timeRecords.studentId, user.id)))
      .returning()

    if (!updatedRecord.length) {
      throw new Error("Time record not found or unauthorized")
    }

    revalidatePath("/dashboard/student")
    return { success: true, timeRecord: updatedRecord[0] }
  } catch (error) {
    console.error("Error updating time record:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update time record",
    }
  }
}

// Get user role
export async function getUserRole(userId: string) {
  try {
    const user = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return user[0]?.role || "STUDENT"
  } catch (error) {
    console.error("Error fetching user role:", error)
    return "STUDENT"
  }
}

// Timecard Correction Actions
export async function createTimecardCorrection(data: {
  originalTimeRecordId: string
  correctionType: string
  requestedChanges: Record<string, unknown>
  reason: string
  priority?: string
}) {
  try {
    const response = await fetch("/api/timecard-corrections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Failed to create timecard correction")
    }

    revalidatePath("/dashboard/student/time-records")
    revalidatePath("/dashboard/clinical-preceptor/time-records")
    return { success: true, correction: result.correction }
  } catch (error) {
    console.error("Error creating timecard correction:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create timecard correction",
    }
  }
}

export async function getTimecardCorrections(params?: {
  studentId?: string
  status?: string
  limit?: number
  sortBy?: string
  sortOrder?: string
}) {
  try {
    const searchParams = new URLSearchParams()
    if (params?.studentId) searchParams.append("studentId", params.studentId)
    if (params?.status) searchParams.append("status", params.status)
    if (params?.limit) searchParams.append("limit", params.limit.toString())
    if (params?.sortBy) searchParams.append("sortBy", params.sortBy)
    if (params?.sortOrder) searchParams.append("sortOrder", params.sortOrder)

    const response = await fetch(`/api/timecard-corrections?${searchParams}`)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Failed to fetch timecard corrections")
    }

    return { success: true, corrections: result.corrections, pagination: result.pagination }
  } catch (error) {
    console.error("Error fetching timecard corrections:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch timecard corrections",
    }
  }
}

export async function reviewTimecardCorrection(
  correctionId: string,
  action: "approve" | "reject",
  reviewComments?: string
) {
  try {
    const response = await fetch(`/api/timecard-corrections/${correctionId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        reviewComments,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Failed to review timecard correction")
    }

    revalidatePath("/dashboard/clinical-preceptor/time-records")
    revalidatePath("/dashboard/school-admin/time-records")
    return { success: true, correction: result.correction }
  } catch (error) {
    console.error("Error reviewing timecard correction:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to review timecard correction",
    }
  }
}

export async function applyTimecardCorrection(correctionId: string) {
  try {
    const response = await fetch(`/api/timecard-corrections/${correctionId}/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Failed to apply timecard correction")
    }

    revalidatePath("/dashboard/clinical-preceptor/time-records")
    revalidatePath("/dashboard/school-admin/time-records")
    revalidatePath("/dashboard/student/time-records")
    return { success: true, correction: result.correction }
  } catch (error) {
    console.error("Error applying timecard correction:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to apply timecard correction",
    }
  }
}

export async function deleteTimecardCorrection(correctionId: string) {
  try {
    const response = await fetch(`/api/timecard-corrections/${correctionId}`, {
      method: "DELETE",
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Failed to delete timecard correction")
    }

    revalidatePath("/dashboard/student/time-records")
    return { success: true, message: result.message }
  } catch (error) {
    console.error("Error deleting timecard correction:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete timecard correction",
    }
  }
}

export async function getTimecardAuditTrail(timeRecordId: string) {
  try {
    const response = await fetch(`/api/timecard-audit/${timeRecordId}`)
    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || "Failed to fetch audit trail")
    }

    return { success: true, auditData: result }
  } catch (error) {
    console.error("Error fetching audit trail:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch audit trail",
    }
  }
}
