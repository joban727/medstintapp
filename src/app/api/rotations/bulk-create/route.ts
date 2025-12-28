import { type NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import { rotations, siteAssignments } from "@/database/schema"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "@/lib/api-response"

const bulkRotationSchema = z.object({
  studentIds: z.array(z.string()),
  clinicalSiteId: z.string(),
  specialty: z.string(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  requiredHours: z.number().optional().default(160),
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const authResult = await apiAuthMiddleware(request)
  if (!authResult.success || !authResult.user || authResult.user.role !== "SCHOOL_ADMIN") {
    return createErrorResponse(
      authResult.error || "Unauthorized",
      authResult.status || HTTP_STATUS.UNAUTHORIZED
    )
  }

  const body = await request.json()
  const validation = bulkRotationSchema.safeParse(body)

  if (!validation.success) {
    return createErrorResponse("Invalid data format", HTTP_STATUS.BAD_REQUEST, validation.error)
  }

  const { studentIds, clinicalSiteId, specialty, startDate, endDate, requiredHours } =
    validation.data

  const results = await Promise.all(
    studentIds.map(async (studentId) => {
      try {
        const rotationId = crypto.randomUUID()
        const sDate = startDate ? new Date(startDate) : null
        const eDate = endDate ? new Date(endDate) : null

        // Create rotation
        await db.insert(rotations).values({
          id: rotationId,
          studentId,
          clinicalSiteId,
          specialty,
          startDate: sDate,
          endDate: eDate,
          requiredHours,
          completedHours: 0,
          status: "SCHEDULED",
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // Create assignment if dates are provided
        if (sDate) {
          await db.insert(siteAssignments).values({
            id: crypto.randomUUID(),
            studentId,
            clinicalSiteId,
            rotationId,
            schoolId: authResult.user!.schoolId || "",
            startDate: sDate,
            endDate: eDate,
            status: "ACTIVE",
            assignedBy: authResult.user!.id,
          })
        }

        return { status: "created", studentId }
      } catch (error) {
        console.error(`Failed to create rotation for student ${studentId}:`, error)
        return { status: "error", studentId, reason: "Database error" }
      }
    })
  )

  const created = results.filter((r) => r.status === "created").length
  const failed = results.filter((r) => r.status === "error").length

  return createSuccessResponse(
    {
      created,
      failed,
      details: results,
    },
    `Created ${created} rotations. ${failed} failed.`
  )
})

