import { type NextRequest } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/database/connection-pool"
import { clinicalSites, rotations } from "@/database/schema"
import {
  withErrorHandling,
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
} from "@/lib/api-response"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(async (request: NextRequest) => {
  const auth = await apiAuthMiddleware(request, {
    requiredRoles: ["SCHOOL_ADMIN", "SUPER_ADMIN"],
  })
  if (!auth.success) {
    return createErrorResponse(
      auth.error || "Unauthorized",
      auth.status || HTTP_STATUS.UNAUTHORIZED
    )
  }

  const { searchParams } = new URL(request.url)
  const siteId = searchParams.get("siteId")
  if (!siteId) {
    return createErrorResponse("siteId is required", HTTP_STATUS.BAD_REQUEST)
  }

  const [site] = await db
    .select({ id: clinicalSites.id, name: clinicalSites.name, capacity: clinicalSites.capacity })
    .from(clinicalSites)
    .where(eq(clinicalSites.id, siteId))
    .limit(1)

  if (!site) {
    return createErrorResponse("Site not found", HTTP_STATUS.NOT_FOUND)
  }

  const assigned = await db
    .select({ id: rotations.id })
    .from(rotations)
    .where(eq(rotations.clinicalSiteId, siteId))

  const available = Math.max(0, Number(site.capacity || 0) - assigned.length)
  return createSuccessResponse({
    siteId,
    capacity: Number(site.capacity || 0),
    assigned: assigned.length,
    available,
  })
})
