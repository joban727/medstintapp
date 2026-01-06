import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/database/connection-pool"
import { locationPermissions } from "@/database/schema"
import { eq, sql } from "drizzle-orm"
import { withErrorHandling } from "@/lib/api-response"

interface LocationPermissionRequest {
  permissionStatus: "granted" | "denied" | "prompt"
  browserInfo?: string
  deviceInfo?: string
  metadata?: any
}

export const GET = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get latest permission status for user
  const permissions = await db
    .select()
    .from(locationPermissions)
    .where(eq(locationPermissions.userId, userId))
    .orderBy(sql`${locationPermissions.updatedAt} DESC`)
    .limit(1)

  if (permissions.length === 0) {
    return NextResponse.json(
      {
        hasPermission: false,
        permissionStatus: "unknown",
        message: "No location permission record found",
      },
      { status: 200 }
    )
  }

  const permission = permissions[0]

  return NextResponse.json(
    {
      hasPermission: permission.permissionStatus === "granted",
      permissionStatus: permission.permissionStatus,
      lastUpdated: permission.updatedAt,
      browserInfo: permission.browserInfo,
      deviceInfo: permission.deviceInfo,
    },
    { status: 200 }
  )
})

export const POST = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { permissionStatus, browserInfo, deviceInfo, metadata }: LocationPermissionRequest = body

  // Validate input
  if (!permissionStatus || !["granted", "denied", "prompt"].includes(permissionStatus)) {
    return NextResponse.json({ error: "Invalid permission status" }, { status: 400 })
  }

  // Save or update permission record
  const permissionRecord = await db
    .insert(locationPermissions)
    .values({
      userId,
      permissionStatus,
      browserInfo: browserInfo || null,
      deviceInfo: deviceInfo || null,
      locationSource: "gps", // Default to gps for now
    })
    .onConflictDoUpdate({
      target: locationPermissions.userId,
      set: {
        permissionStatus,
        browserInfo,
        deviceInfo,
        locationSource: "gps",
        updatedAt: new Date(),
      },
    })
    .returning()

  const permission = permissionRecord[0]

  return NextResponse.json(
    {
      success: true,
      permissionId: permission.id,
      permissionStatus: permission.permissionStatus,
      hasPermission: permission.permissionStatus === "granted",
      timestamp: permission.updatedAt,
    },
    { status: 200 }
  )
})

export const DELETE = withErrorHandling(async (request: NextRequest) => {
  const { userId } = await auth()

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Delete all permission records for user
  await db.delete(locationPermissions).where(eq(locationPermissions.userId, userId))

  return NextResponse.json(
    {
      success: true,
      message: "Location permissions cleared",
    },
    { status: 200 }
  )
})
