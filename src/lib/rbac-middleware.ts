import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { db } from "@/database/db"
import { auditLogs, users } from "@/database/schema"
import { hasPermission, type Permission, ROLE_HIERARCHY } from "@/lib/auth"
import { getCurrentUser } from "@/lib/auth-clerk"
import type { UserRole } from "@/types"

// Route protection configuration
export interface RouteConfig {
  path: string
  roles: UserRole[]
  permissions?: Permission[]
  requireAll?: boolean // If true, user must have ALL permissions, otherwise ANY
}

// Protected routes configuration
export const PROTECTED_ROUTES: RouteConfig[] = [
  // Super Admin routes
  {
    path: "/dashboard/admin",
    roles: ["SUPER_ADMIN"],
    permissions: ["system_settings", "audit_logs"],
  },
  {
    path: "/dashboard/admin/schools",
    roles: ["SUPER_ADMIN"],
    permissions: ["manage_schools"],
  },
  {
    path: "/dashboard/admin/users",
    roles: ["SUPER_ADMIN"],
    permissions: ["manage_users"],
  },

  // School Admin routes
  {
    path: "/dashboard/school-admin",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  },
  {
    path: "/dashboard/school-admin/students",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_students"],
  },
  {
    path: "/dashboard/school-admin/rotations",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_rotations"],
  },

  // Clinical Preceptor routes
  {
    path: "/dashboard/clinical-preceptor",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR"],
  },
  {
    path: "/dashboard/clinical-preceptor/timesheets",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR"],
    permissions: ["approve_timesheets"],
  },

  // Clinical Supervisor routes
  {
    path: "/dashboard/clinical-supervisor",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"],
  },
  {
    path: "/dashboard/clinical-supervisor/assessments",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_assessments"],
  },

  // Student routes
  {
    path: "/dashboard/student",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
  },
]

// API route protection
export const PROTECTED_API_ROUTES: RouteConfig[] = [
  {
    path: "/api/admin",
    roles: ["SUPER_ADMIN"],
    permissions: ["system_settings"],
  },
  {
    path: "/api/schools",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_schools"],
  },
  {
    path: "/api/users",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_users"],
  },
  {
    path: "/api/students",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"],
    permissions: ["view_student_progress"],
  },
  {
    path: "/api/assessments",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_assessments"],
  },
  {
    path: "/api/timesheets",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "STUDENT"],
    permissions: ["approve_timesheets", "submit_timesheets"],
  },
  {
    path: "/api/timecard-corrections",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "STUDENT"],
    permissions: [
      "submit_timecard_corrections",
      "review_timecard_corrections",
      "view_timecard_corrections",
      "manage_timecard_corrections",
    ],
  },
]

// Get user from database by ID
export async function getUserById(userId: string, retryCount = 0) {
  const maxRetries = 3
  const retryDelay = 1000 // 1 second

  try {
    const user = await db
      .select({
        id: users.id,
        role: users.role,
        email: users.email,
        name: users.name,
        schoolId: users.schoolId,
        isActive: users.isActive,
        onboardingCompleted: users.onboardingCompleted,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return user[0] || null
  } catch (error) {
    console.error(`Error fetching user (attempt ${retryCount + 1}/${maxRetries + 1}):`, error)

    // If we haven't exceeded max retries, try again
    if (retryCount < maxRetries) {
      console.log(`Retrying getUserById for user ${userId} in ${retryDelay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
      return getUserById(userId, retryCount + 1)
    }

    // After all retries failed, throw the error instead of returning null
    // This prevents the redirect loop by allowing the caller to handle the error
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to fetch user ${userId} after ${maxRetries + 1} attempts: ${errorMessage}`
    )
  }
}

// Log audit event
export async function logAuditEvent({
  userId,
  action,
  resource,
  resourceId,
  details,
  ipAddress,
  userAgent,
  severity = "LOW",
  status = "SUCCESS",
}: {
  userId?: string
  action: string
  resource?: string
  resourceId?: string
  details?: Record<string, unknown> | string
  ipAddress?: string
  userAgent?: string
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
  status?: "SUCCESS" | "FAILURE" | "ERROR"
}) {
  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userId,
      action,
      resource,
      resourceId,
      details: details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent,
      severity,
      status,
      createdAt: new Date(),
    })
  } catch (error) {
    console.error("Error logging audit event:", error)
  }
}

// Check if user has access to route
export function hasRouteAccess(
  userRole: UserRole,
  routePath: string,
  routeConfigs: RouteConfig[]
): { hasAccess: boolean; config?: RouteConfig; reason?: string } {
  const config = routeConfigs.find((route) => routePath.startsWith(route.path))

  if (!config) {
    return { hasAccess: true } // No specific protection configured
  }

  // Check role access
  if (!config.roles.includes(userRole)) {
    return {
      hasAccess: false,
      config,
      reason: `Role ${userRole} not authorized for this route`,
    }
  }

  // Check permissions if specified
  if (config.permissions && config.permissions.length > 0) {
    const hasRequiredPermissions = config.requireAll
      ? config.permissions.every((permission) => hasPermission(userRole, permission))
      : config.permissions.some((permission) => hasPermission(userRole, permission))

    if (!hasRequiredPermissions) {
      return {
        hasAccess: false,
        config,
        reason: `Missing required permissions: ${config.permissions.join(", ")}`,
      }
    }
  }

  return { hasAccess: true, config }
}

// API Authorization function for API routes
export async function apiAuthMiddleware(
  request: NextRequest,
  options?: {
    requiredRoles?: UserRole[]
    requiredPermissions?: Permission[]
    requireAll?: boolean
    requireAny?: boolean
  }
): Promise<{
  success: boolean
  error?: string
  status?: number
  user?: typeof getCurrentUser extends () => Promise<infer U> ? U : never
}> {
  const {
    requiredRoles,
    requiredPermissions,
    requireAll = false,
    requireAny = false,
  } = options || {}
  try {
    // Get current user
    const user = await getCurrentUser()

    if (!user) {
      return {
        success: false,
        error: "Authentication required",
        status: 401,
      }
    }

    // Check role-based access if required roles are specified
    if (requiredRoles && requiredRoles.length > 0) {
      if (!requiredRoles.includes(user.role as UserRole)) {
        await logAuditEvent({
          userId: user.id,
          action: "ACCESS_DENIED",
          resource: "API_ROUTE",
          resourceId: request.nextUrl.pathname,
          details: { reason: "Insufficient role", userRole: user.role, requiredRoles },
          ipAddress:
            request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
          userAgent: request.headers.get("user-agent") || undefined,
          severity: "MEDIUM",
          status: "FAILURE",
        })

        return {
          success: false,
          error: "Insufficient permissions",
          status: 403,
        }
      }
    }

    // Check permission-based access if required permissions are specified
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasRequiredPermissions = requireAll
        ? requiredPermissions.every((permission) =>
            hasPermission(user.role as UserRole, permission)
          )
        : requireAny
          ? requiredPermissions.some((permission) =>
              hasPermission(user.role as UserRole, permission)
            )
          : requiredPermissions.some((permission) =>
              hasPermission(user.role as UserRole, permission)
            )

      if (!hasRequiredPermissions) {
        await logAuditEvent({
          userId: user.id,
          action: "ACCESS_DENIED",
          resource: "API_ROUTE",
          resourceId: request.nextUrl.pathname,
          details: { reason: "Insufficient permissions", userRole: user.role, requiredPermissions },
          ipAddress:
            request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
          userAgent: request.headers.get("user-agent") || undefined,
          severity: "MEDIUM",
          status: "FAILURE",
        })

        return {
          success: false,
          error: "Insufficient permissions",
          status: 403,
        }
      }
    }

    return {
      success: true,
      user,
    }
  } catch (error) {
    console.error("API auth middleware error:", error)
    return {
      success: false,
      error: "Internal server error",
      status: 500,
    }
  }
}

// Role creation validation
export function canCreateRole(creatorRole: UserRole, targetRole: UserRole): boolean {
  const _creatorLevel = ROLE_HIERARCHY[creatorRole]
  const _targetLevel = ROLE_HIERARCHY[targetRole]

  // SUPER_ADMIN can create any role
  if (creatorRole === "SUPER_ADMIN") {
    return true
  }

  // SCHOOL_ADMIN can create CLINICAL_PRECEPTOR, CLINICAL_SUPERVISOR, STUDENT
  if (creatorRole === "SCHOOL_ADMIN") {
    return ["CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"].includes(targetRole)
  }

  // Other roles cannot create users
  return false
}

// Role modification validation
export function canModifyRole(
  modifierRole: UserRole,
  currentRole: UserRole,
  newRole: UserRole
): boolean {
  // SUPER_ADMIN can modify any role
  if (modifierRole === "SUPER_ADMIN") {
    return true
  }

  // SCHOOL_ADMIN can promote/demote between CLINICAL_PRECEPTOR ↔ CLINICAL_SUPERVISOR
  if (modifierRole === "SCHOOL_ADMIN") {
    const allowedRoles = ["CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"]
    return allowedRoles.includes(currentRole) && allowedRoles.includes(newRole)
  }

  return false
}

// School isolation check
export function canAccessSchoolData(
  userRole: UserRole,
  userSchoolId: string,
  targetSchoolId: string
): boolean {
  // SUPER_ADMIN can access all school data
  if (userRole === "SUPER_ADMIN") {
    return true
  }

  // All other roles are limited to their school
  return userSchoolId === targetSchoolId
}
