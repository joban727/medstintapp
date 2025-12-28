import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import { schools } from "../../../../database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withErrorHandlingAsync(async () => {
    const clerkUser = await currentUser()

    if (!clerkUser) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const body = await request.json()
    const { name, address, phone, email, website } = body

    if (!name || !email) {
      return createErrorResponse("School name and email are required", HTTP_STATUS.BAD_REQUEST)
    }

    const [updatedSchool] = await db
      .update(schools)
      .set({
        name,
        address: address || "",
        phone: phone || "",
        email,
        website: website || null,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, id))
      .returning()

    if (!updatedSchool) {
      return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
    }

    // Invalidate related caches
    try {
      await cacheIntegrationService.clear()
    } catch (cacheError) {
      console.warn("Cache invalidation error in schools/[id]/route.ts:", cacheError)
    }

    return createSuccessResponse({
      message: "School updated successfully",
      data: updatedSchool,
    })
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withErrorHandlingAsync(async () => {
    const clerkUser = await currentUser()

    if (!clerkUser) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    // Soft delete by setting isActive to false
    const [deactivatedSchool] = await db
      .update(schools)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(schools.id, id))
      .returning()

    if (!deactivatedSchool) {
      return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
    }

    // Invalidate related caches
    try {
      await cacheIntegrationService.clear()
    } catch (cacheError) {
      console.warn("Cache invalidation error in schools/[id]/route.ts:", cacheError)
    }

    return createSuccessResponse({
      message: "School deactivated successfully",
      data: deactivatedSchool,
    })
  })
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return withErrorHandlingAsync(async () => {
    // Try to get cached response
    try {
      const cached = await cacheIntegrationService.cachedApiResponse(
        `api:schools:${id}`,
        async () => {
          const school = await db.select().from(schools).where(eq(schools.id, id)).limit(1)

          if (school.length === 0) {
            return null
          }
          return school[0]
        },
        300 // 5 minutes TTL
      )

      if (cached === null) {
        return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
      }

      return createSuccessResponse({
        data: cached,
      })
    } catch (cacheError) {
      console.warn("Cache error in schools/[id]/route.ts:", cacheError)
      // Fallback to direct query if cache fails
      const school = await db.select().from(schools).where(eq(schools.id, id)).limit(1)

      if (school.length === 0) {
        return createErrorResponse(ERROR_MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND)
      }

      return createSuccessResponse({
        data: school[0],
      })
    }
  })
}
