import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import type { UserRole } from "@/types"
import { clinicalSites, rotations, timeRecords, users } from "@/database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  withErrorHandlingAsync,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "../../../../lib/api-response"

export async function GET(request: NextRequest) {
  return withErrorHandlingAsync(async () => {
    const { userId } = await auth()

    if (!userId) {
      return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!user.length) {
      return createErrorResponse("User not found", HTTP_STATUS.NOT_FOUND)
    }

    const currentUser = user[0]

    if (currentUser.role !== ("STUDENT" as UserRole as UserRole)) {
      return createErrorResponse(ERROR_MESSAGES.ACCESS_DENIED, HTTP_STATUS.FORBIDDEN)
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const siteId = searchParams.get("siteId")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const schoolId = searchParams.get("schoolId")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    const cacheKey = `api:time-records:history:${currentUser.id}:${status || "all"}:${siteId || "all"}:${dateFrom || ""}:${dateTo || ""}:${limit}:${offset}`

    const response = await cacheIntegrationService.cached(
      cacheKey,
      async () => {
        const conditions = [eq(timeRecords.studentId, currentUser.id)]

        if (status && status !== "all") {
          if (status === "active") {
            conditions.push(isNull(timeRecords.clockOut))
          } else if (status === "completed") {
            conditions.push(isNotNull(timeRecords.clockOut))
          }
        }

        if (siteId && siteId !== "all") {
          conditions.push(eq(rotations.clinicalSiteId, siteId))
        }

        if (dateFrom) {
          const fromDate = new Date(dateFrom)
          fromDate.setHours(0, 0, 0, 0)
          conditions.push(gte(timeRecords.clockIn, fromDate))
        }

        if (dateTo) {
          const toDate = new Date(dateTo)
          toDate.setHours(23, 59, 59, 999)
          conditions.push(lte(timeRecords.clockIn, toDate))
        }

        // Build schoolId condition - only add if we have a valid schoolId
        const schoolIdVal = schoolId || currentUser.schoolId
        if (schoolIdVal) {
          conditions.push(eq(users.schoolId, schoolIdVal))
        }

        const records = await db
          .select({
            id: timeRecords.id,
            clockInTime: timeRecords.clockIn,
            clockOutTime: timeRecords.clockOut,
            totalHours: timeRecords.totalHours,
            notes: timeRecords.notes,
            createdAt: timeRecords.createdAt,
            clinicalSite: {
              id: clinicalSites.id,
              name: clinicalSites.name,
              address: clinicalSites.address,
            },
            rotation: {
              id: rotations.id,
              name: rotations.specialty,
            },
          })
          .from(timeRecords)
          .innerJoin(rotations, eq(timeRecords.rotationId, rotations.id))
          .innerJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
          .innerJoin(users, eq(timeRecords.studentId, users.id))
          .where(and(...conditions))
          .orderBy(desc(timeRecords.clockIn))
          .limit(limit)
          .offset(offset)

        const formattedRecords = records.map((record) => ({
          ...record,
          status: record.clockOutTime ? "completed" : "active",
        }))

        const totalCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(timeRecords)
          .innerJoin(rotations, eq(timeRecords.rotationId, rotations.id))
          .innerJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
          .innerJoin(users, eq(timeRecords.studentId, users.id))
          .where(and(...conditions))

        return createSuccessResponse({
          records: formattedRecords,
          pagination: {
            total: Number(totalCount[0]?.count || 0),
            limit,
            offset,
            hasMore: formattedRecords.length === limit,
          },
        })
      },
      { ttl: 60, tags: [`user:${currentUser.id}:time-records`] }
    )

    return response
  })
}

