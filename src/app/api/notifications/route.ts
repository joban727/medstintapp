import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { db } from "@/database/connection-pool"
import { notifications } from "@/database/schema"
import { eq, desc, and, isNull } from "drizzle-orm"
import { logger } from "@/lib/logger"

export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt) // Fetch unread notifications, or we could fetch all and filter in UI
        )
      )
      .orderBy(desc(notifications.createdAt))
      .limit(10)

    return NextResponse.json(userNotifications)
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch notifications")
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
