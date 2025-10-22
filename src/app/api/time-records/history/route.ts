import { auth } from "@clerk/nextjs/server"
import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/db"
import { clinicalSites, rotations, timeRecords, users } from "@/database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:time-records/history/route.ts',
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
    console.warn('Cache error in time-records/history/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user from database
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!user.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const currentUser = user[0]

    // Check if user is a student
    if (currentUser.role !== "STUDENT") {
      return NextResponse.json({ error: "Access denied. Students only." }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const siteId = searchParams.get("siteId")
    const dateFrom = searchParams.get("dateFrom")
    const dateTo = searchParams.get("dateTo")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Build query conditions
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

    // Fetch time records with related data
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
      .innerJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
      .innerJoin(rotations, eq(timeRecords.rotationId, rotations.id))
      .where(and(...conditions))
      .orderBy(desc(timeRecords.clockIn))
      .limit(limit)
      .offset(offset)

    // Format records with status
    const formattedRecords = records.map((record) => ({
      ...record,
      status: record.clockOutTime ? "completed" : "active",
    }))

    // Get total count for pagination
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(timeRecords)
      .innerJoin(clinicalSites, eq(rotations.clinicalSiteId, clinicalSites.id))
      .innerJoin(rotations, eq(timeRecords.rotationId, rotations.id))
      .where(and(...conditions))

    return NextResponse.json({
      success: true,
      records: formattedRecords,
      pagination: {
        total: Number(totalCount[0]?.count || 0),
        limit,
        offset,
        hasMore: formattedRecords.length === limit,
      },
    })
  } catch (error) {
    console.error("Error fetching time records history:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  }
}
