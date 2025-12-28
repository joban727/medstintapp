import type { UserRole } from "@/types"
import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../database/connection-pool"
import { users } from "../../../database/schema"
import {
  createSuccessResponse,
  createErrorResponse,
  HTTP_STATUS,
  ERROR_MESSAGES,
  withErrorHandling,
} from "../../../lib/api-response"

export const GET = withErrorHandling(async (_request: NextRequest) => {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }

  // Get current user to check permissions
  const [currentDbUser] = await db
    .select({
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, clerkUser.id))
    .limit(1)

  // Only super admins can view all users
  if (!currentDbUser || currentDbUser.role !== ("SUPER_ADMIN" as UserRole as UserRole)) {
    return createErrorResponse(ERROR_MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN)
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      schoolId: users.schoolId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt)

  return createSuccessResponse(allUsers, "Users retrieved successfully")
})

