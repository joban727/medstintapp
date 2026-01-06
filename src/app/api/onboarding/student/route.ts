import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import { users } from "@/database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"
import { withCSRF } from "@/lib/csrf-middleware"

export const POST = withCSRF(async (request: Request) => {
  try {
    const body = await request.json()
    const { userId, schoolId, programId } = body ?? {}

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Missing userId" }, { status: 400 })
    }

    // Update user with Drizzle ORM syntax
    const [userUpdate] = await db
      .update(users)
      .set({
        schoolId: schoolId ?? null,
        programId: programId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning()

    // Invalidate caches
    try {
      await cacheIntegrationService.clear()
    } catch (cacheError) {
      console.warn("Cache invalidation error:", cacheError)
    }

    // Note: Auto-assignment feature temporarily disabled
    // The assignBestClinicalSite function was not properly implemented
    const assignedSite = null

    return NextResponse.json({ ok: true, user: userUpdate, assignedSite })
  } catch (error) {
    return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 })
  }
})
