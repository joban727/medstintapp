import { type NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import { clinicalSites } from "@/database/schema"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "@/lib/api-response"

const siteImportSchema = z.array(
  z.object({
    name: z.string().min(1),
    address: z.string().optional(),
    type: z.enum(["HOSPITAL", "CLINIC", "NURSING_HOME", "OUTPATIENT", "OTHER"]).optional().default("CLINIC"),
    capacity: z.number().optional().default(10),
  })
)

export const POST = withErrorHandling(async (request: NextRequest) => {
  const authResult = await apiAuthMiddleware(request)
  if (!authResult.success || !authResult.user || authResult.user.role !== "SCHOOL_ADMIN") {
    return createErrorResponse(
      authResult.error || "Unauthorized",
      authResult.status || HTTP_STATUS.UNAUTHORIZED
    )
  }

  const body = await request.json()
  const validation = siteImportSchema.safeParse(body)

  if (!validation.success) {
    return createErrorResponse("Invalid data format", HTTP_STATUS.BAD_REQUEST, validation.error)
  }

  const sites = validation.data
  const schoolId = authResult.user.schoolId!

  const results = await Promise.all(
    sites.map(async (site) => {
      try {
        await db.insert(clinicalSites).values({
          id: crypto.randomUUID(),
          name: site.name,
          address: site.address || "Address pending",
          phone: "Pending",
          email: "pending@example.com",
          type: site.type,
          capacity: site.capacity,
          schoolId: schoolId,
          isActive: true,
          specialties: JSON.stringify(["General"]), // Default specialty
        })

        return { status: "created", name: site.name }
      } catch (error) {
        console.error(`Failed to import site ${site.name}:`, error)
        return { status: "error", name: site.name, reason: "Database error" }
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
    `Imported ${created} sites. ${failed} failed.`
  )
})

