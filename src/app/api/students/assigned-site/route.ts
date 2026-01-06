import { NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import { rotations, clinicalSites, users } from "@/database/schema"
import { eq, and } from "drizzle-orm"
import { getSchoolContext } from "@/lib/school-utils"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "@/lib/api-response"

export const GET = withErrorHandling(async () => {
  // Get school context (user authentication)
  const context = await getSchoolContext()

  const { userId } = context

  // Find the student's active rotation with assigned clinical site
  const activeRotation = await db
    .select({
      rotationId: rotations.id,
      rotationName: rotations.specialty,
      rotationStatus: rotations.status,
      siteName: clinicalSites.name,
      siteAddress: clinicalSites.address,
      siteType: clinicalSites.type,
      sitePhone: clinicalSites.contactPersonPhone,
      siteEmail: clinicalSites.contactPersonEmail,
      startDate: rotations.startDate,
      endDate: rotations.endDate,
    })
    .from(rotations)
    .innerJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
    .innerJoin(users, eq(rotations.studentId, users.id))
    .where(and(eq(users.id, userId), eq(rotations.status, "ACTIVE")))
    .limit(1)

  if (activeRotation.length === 0) {
    return createSuccessResponse({
      hasAssignedSite: false,
      message: "No clinical site assigned",
    })
  }

  const rotation = activeRotation[0]

  return createSuccessResponse({
    hasAssignedSite: true,
    assignedSite: {
      name: rotation.siteName,
      address: rotation.siteAddress,
      type: rotation.siteType,
      phone: rotation.sitePhone,
      email: rotation.siteEmail,
    },
    rotation: {
      id: rotation.rotationId,
      name: rotation.rotationName,
      status: rotation.rotationStatus,
      startDate: rotation.startDate,
      endDate: rotation.endDate,
    },
  })
})
