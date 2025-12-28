import { eq } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { db } from "@/database/connection-pool"
import { auditLogs, users } from "@/database/schema"
import { hasPermission, type Permission, ROLE_HIERARCHY } from "@/lib/auth"
import { getCurrentUser } from "@/lib/auth-clerk"
import type { UserRole } from "@/types"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, [
    "SCHOOL_ADMIN" as UserRole,
    "ADMIN" as UserRole,
    "SUPER_ADMIN" as UserRole,
  ])
}
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
  {
    path: "/dashboard/school-admin/rotation-templates",
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
  // (removed: pending-tasks route deleted)
  {
    path: "/api/reports",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"],
    permissions: ["view_reports", "generate_reports"],
  },
  {
    path: "/api/reports/scheduled",
    roles: ["SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_scheduled_reports"],
  },
  {
    path: "/api/reports/schedule",
    roles: ["SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_scheduled_reports"],
  },
  {
    path: "/api/reports/comprehensive",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"],
    permissions: ["view_reports", "generate_reports"],
  },
  {
    path: "/api/reports/export",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"],
    permissions: ["export_reports"],
  },
  {
    path: "/api/time-records",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["view_time_records", "manage_time_records"],
  },
  {
    path: "/api/rotations",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_rotations", "view_rotations"],
  },
  {
    path: "/api/rotation-templates",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_rotations"],
  },
  {
    path: "/api/cohort-rotations",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_rotations"],
  },
  {
    path: "/api/clinical-sites",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_clinical_sites"],
  },
  {
    path: "/api/preceptors",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_preceptors"],
  },
  {
    path: "/api/programs",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_programs"],
  },
  {
    path: "/api/competencies",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_competencies"],
  },
  {
    path: "/api/evaluations",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_evaluations"],
  },
  {
    path: "/api/sites",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_clinical_sites"],
  },
  {
    path: "/api/location",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_locations"],
  },
  {
    path: "/api/audit-logs",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["view_audit_logs"],
  },
  {
    path: "/api/analytics",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["view_analytics"],
  },
  {
    path: "/api/billing",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_billing"],
  },
  {
    path: "/api/onboarding",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["manage_onboarding"],
  },
  // (removed: system route deleted)
  {
    path: "/api/webhooks",
    roles: ["SUPER_ADMIN"],
    permissions: ["manage_webhooks"],
  },
  // (removed: websocket route deleted)
  {
    path: "/api/health",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["view_health_status"],
  },
  {
    path: "/api/clock",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["use_clock"],
  },
  {
    path: "/api/student",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["view_student_dashboard"],
  },
  {
    path: "/api/user",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["manage_user_profile"],
  },
  {
    path: "/api/facility-management",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_facilities"],
  },
  // (removed: rotation-templates route deleted)
  {
    path: "/api/site-assignments",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_site_assignments"],
  },
  // (removed: notification-templates route deleted)
  {
    path: "/api/competency-submissions",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["manage_competency_submissions", "view_competency_submissions"],
  },
  {
    path: "/api/competency-assignments",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["manage_competency_assignments", "view_competency_assignments"],
  },
  {
    path: "/api/competency-templates",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_competency_templates"],
  },
  {
    path: "/api/competency-analytics",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"],
    permissions: ["view_competency_analytics"],
  },
  {
    path: "/api/competency-notifications",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["manage_competency_notifications"],
  },
  {
    path: "/api/competency-progress",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["view_competency_progress"],
  },
  {
    path: "/api/competency-deployments",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_competency_deployments"],
  },
  {
    path: "/api/competency-assessments",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_competency_assessments"],
  },
  {
    path: "/api/school-context",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["view_school_context"],
  },
  {
    path: "/api/facility-management",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_facilities"],
  },
  // (removed: facility-cache route deleted)
  // (removed: facility-lookup route deleted)
  {
    path: "/api/location",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["manage_locations"],
  },
  {
    path: "/api/location/capture",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["capture_location"],
  },
  {
    path: "/api/location/verify",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["verify_location"],
  },
  {
    path: "/api/location/permissions",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["manage_location_permissions"],
  },
  {
    path: "/api/time-sync",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["manage_time_sync"],
  },
  {
    path: "/api/time-sync/poll",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["poll_time_sync"],
  },
  {
    path: "/api/time-sync/connect",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["connect_time_sync"],
  },
  {
    path: "/api/time-sync/status",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["view_time_sync_status"],
  },
  {
    path: "/api/student/dashboard",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "STUDENT"],
    permissions: ["view_student_dashboard"],
  },
  {
    path: "/api/student/dashboard-stats",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "STUDENT"],
    permissions: ["view_student_dashboard_stats"],
  },
  {
    path: "/api/student/clock-in",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "STUDENT"],
    permissions: ["student_clock_in"],
  },
  {
    path: "/api/student/clock-out",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "STUDENT"],
    permissions: ["student_clock_out"],
  },
  {
    path: "/api/student/clock-status",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "STUDENT"],
    permissions: ["view_student_clock_status"],
  },
  {
    path: "/api/evaluations",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"],
    permissions: ["manage_evaluations"],
  },
  {
    path: "/api/onboarding/session",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
    permissions: ["manage_onboarding_session"],
  },
  {
    path: "/api/analytics/onboarding",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["view_onboarding_analytics"],
  },
  // (removed: system/readiness route deleted)
  {
    path: "/api/admin/performance",
    roles: ["SUPER_ADMIN"],
    permissions: ["view_admin_performance"],
  },
  {
    path: "/api/admin/cleanup-mock-data",
    roles: ["SUPER_ADMIN"],
    permissions: ["cleanup_mock_data"],
  },
  {
    path: "/api/billing/create-subscription",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["create_subscription"],
  },
  {
    path: "/api/billing/cancel-subscription",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["cancel_subscription"],
  },
  {
    path: "/api/webhooks/clerk",
    roles: ["SYSTEM"],
    permissions: ["webhook_clerk"],
  },
  // (removed: test routes deleted)

  {
    path: "/api/schedule/timeline",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["view_schedule"],
  },
  {
    path: "/api/schedule/conflicts",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["view_schedule"],
  },
  {
    path: "/api/sites/capacity",
    roles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
    permissions: ["manage_clinical_sites"],
  },
]

// Get user from database by ID
export async function getUserById(userId: string, retryCount = 0) {
  const maxRetries = 3
  const retryDelay = 1000 // 1 second

  try {
    const user = await db
      .select()
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
    return [
      "CLINICAL_PRECEPTOR" as UserRole,
      "CLINICAL_SUPERVISOR" as UserRole,
      "STUDENT" as UserRole,
    ].includes(targetRole)
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
