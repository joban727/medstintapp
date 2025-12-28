import { NextRequest } from "next/server"
import { db } from "@/database/db"
import { users } from "@/database/schema"
import { eq, and } from "drizzle-orm"
import { auth } from "@clerk/nextjs/server"
import {
    createErrorResponse,
    createSuccessResponse,
    HTTP_STATUS,
    ERROR_MESSAGES,
    withErrorHandling,
} from "@/lib/api-response"
import { invalidateUserCache } from "@/lib/auth-utils"

export const dynamic = "force-dynamic"

export const GET = withErrorHandling(async (request: NextRequest) => {
    const { userId } = await auth()

    if (!userId) {
        return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!currentUser || (currentUser.role !== "SCHOOL_ADMIN" && currentUser.role !== "SUPER_ADMIN")) {
        return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    // Super admin sees all pending users; school admin sees only their school
    let pendingUsers
    if (currentUser.role === "SUPER_ADMIN") {
        pendingUsers = await db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                schoolId: users.schoolId,
                programId: users.programId,
                createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.approvalStatus, "PENDING"))
    } else {
        if (!currentUser.schoolId) {
            return createErrorResponse("User is not associated with a school", HTTP_STATUS.BAD_REQUEST)
        }
        pendingUsers = await db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                role: users.role,
                programId: users.programId,
                createdAt: users.createdAt,
            })
            .from(users)
            .where(
                and(
                    eq(users.schoolId, currentUser.schoolId),
                    eq(users.approvalStatus, "PENDING")
                )
            )
    }

    return createSuccessResponse(pendingUsers, "Pending approvals fetched successfully")
})

export const POST = withErrorHandling(async (request: NextRequest) => {
    const { userId } = await auth()

    if (!userId) {
        return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!currentUser || (currentUser.role !== "SCHOOL_ADMIN" && currentUser.role !== "SUPER_ADMIN")) {
        return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    const body = await request.json()
    const { targetUserId, action } = body

    if (!targetUserId || !["APPROVE", "REJECT"].includes(action)) {
        return createErrorResponse(ERROR_MESSAGES.VALIDATION_ERROR, HTTP_STATUS.BAD_REQUEST)
    }

    // Verify target user exists
    const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1)

    if (!targetUser) {
        return createErrorResponse("User not found", HTTP_STATUS.NOT_FOUND)
    }

    // Super admins can approve any user; school admins only their school
    if (currentUser.role !== "SUPER_ADMIN" && targetUser.schoolId !== currentUser.schoolId) {
        return createErrorResponse(ERROR_MESSAGES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
    }

    if (action === "APPROVE") {
        await db
            .update(users)
            .set({ approvalStatus: "APPROVED", updatedAt: new Date() })
            .where(eq(users.id, targetUserId))
    } else if (action === "REJECT") {
        await db
            .update(users)
            .set({ approvalStatus: "REJECTED", isActive: false, updatedAt: new Date() })
            .where(eq(users.id, targetUserId))
    }

    // Invalidate cache so the user's status is immediately reflected
    invalidateUserCache(targetUserId)

    return createSuccessResponse(null, `User ${action === "APPROVE" ? "approved" : "rejected"} successfully`)
})
