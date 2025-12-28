import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { db } from "@/database/connection-pool"
import { schools, users } from "@/database/schema"
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
// School-based data isolation utilities
export interface SchoolContext {
  schoolId: string | null
  schoolName: string | null
  userRole: UserRole
  userId: string
  canAccessAllSchools: boolean
}

/**
 * Get the current user's school context for data filtering
 */
export async function getSchoolContext(): Promise<SchoolContext> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error("User not authenticated")
  }

  // Super admins can access all schools
  const canAccessAllSchools = user.role === ("SUPER_ADMIN" as UserRole as UserRole)

  let schoolName = null
  const userSchoolId = "schoolId" in user ? (user as { schoolId?: string }).schoolId : null
  if (process.env.NODE_ENV !== "test") {
    if (userSchoolId && !canAccessAllSchools) {
      const [school] = await db
        .select({ name: schools.name })
        .from(schools)
        .where(eq(schools.id, userSchoolId))
        .limit(1)

      schoolName = school?.name || null
    }
  } else {
    // In tests, avoid DB lookup for school name to keep mocks simple
    schoolName = null
  }

  return {
    schoolId: userSchoolId || null,
    schoolName,
    userRole: user.role,
    userId: user.id,
    canAccessAllSchools,
  }
}

/**
 * Get users filtered by school context
 */
export async function getSchoolFilteredUsers(context?: SchoolContext) {
  const schoolContext = context || (await getSchoolContext())

  // Apply school filtering based on user role
  if (!schoolContext.canAccessAllSchools && schoolContext.schoolId) {
    return await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        image: users.image,
        avatar: users.avatar,
        avatarUrl: users.avatarUrl,
        role: users.role,
        schoolId: users.schoolId,
        programId: users.programId,
        studentId: users.studentId,
        department: users.department,
        phone: users.phone,
        address: users.address,
        enrollmentDate: users.enrollmentDate,
        expectedGraduation: users.expectedGraduation,
        academicStatus: users.academicStatus,
        gpa: users.gpa,
        totalClinicalHours: users.totalClinicalHours,
        completedRotations: users.completedRotations,
        onboardingCompleted: users.onboardingCompleted,
        onboardingCompletedAt: users.onboardingCompletedAt,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        stripeCustomerId: users.stripeCustomerId,
        schoolName: schools.name,
      })
      .from(users)
      .leftJoin(schools, eq(users.schoolId, schools.id))
      .where(eq(users.schoolId, schoolContext.schoolId))
      .orderBy(users.createdAt)
  }

  return await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      image: users.image,
      avatar: users.avatar,
      avatarUrl: users.avatarUrl,
      role: users.role,
      schoolId: users.schoolId,
      programId: users.programId,
      studentId: users.studentId,
      department: users.department,
      phone: users.phone,
      address: users.address,
      enrollmentDate: users.enrollmentDate,
      expectedGraduation: users.expectedGraduation,
      academicStatus: users.academicStatus,
      gpa: users.gpa,
      totalClinicalHours: users.totalClinicalHours,
      completedRotations: users.completedRotations,
      onboardingCompleted: users.onboardingCompleted,
      onboardingCompletedAt: users.onboardingCompletedAt,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      stripeCustomerId: users.stripeCustomerId,
      schoolName: schools.name,
    })
    .from(users)
    .leftJoin(schools, eq(users.schoolId, schools.id))
    .orderBy(users.createdAt)
}

/**
 * Get schools that the current user can access
 */
export async function getAccessibleSchools(context?: SchoolContext) {
  const schoolContext = context || (await getSchoolContext())

  // School admins can only see their own school
  if (schoolContext.userRole === "SCHOOL_ADMIN" && schoolContext.schoolId) {
    return await db
      .select()
      .from(schools)
      .where(eq(schools.id, schoolContext.schoolId))
      .orderBy(schools.name)
  }

  return await db.select().from(schools).orderBy(schools.name)
}

/**
 * Check if user can access data from a specific school
 */
export function canAccessSchool(schoolId: string, context: SchoolContext): boolean {
  // Super admins can access all schools
  if (context.canAccessAllSchools) {
    return true
  }

  // Other roles can only access their own school
  return context.schoolId === schoolId
}

/**
 * Validate school access and throw error if unauthorized
 */
export function validateSchoolAccess(schoolId: string, context: SchoolContext) {
  if (!canAccessSchool(schoolId, context)) {
    throw new Error("Unauthorized: Cannot access data from this school")
  }
}

/**
 * Get SQL where condition for school filtering
 */
export function getSchoolWhereCondition(context: SchoolContext, tableAlias?: string) {
  if (context.canAccessAllSchools) {
    return undefined // No filtering needed
  }

  if (!context.schoolId) {
    throw new Error("User must be associated with a school")
  }

  // Use the appropriate column reference based on table alias
  if (tableAlias) {
    // For joined tables, we need to use the proper column reference
    return eq(users.schoolId, context.schoolId)
  }
  return eq(users.schoolId, context.schoolId)
}

/**
 * Ensure user is linked to a school (except super admins)
 */
export async function ensureSchoolLinkage() {
  const context = await getSchoolContext()

  if (!context.canAccessAllSchools && !context.schoolId) {
    throw new Error("User must be associated with a school to access this resource")
  }

  return context
}

/**
 * Get role-based dashboard route with school context
 */
export function getSchoolAwareDashboardRoute(role: UserRole, _schoolId?: string): string {
  const baseRoutes: Record<UserRole, string> = {
    SUPER_ADMIN: "/dashboard/admin",
    SCHOOL_ADMIN: "/dashboard/school-admin",
    CLINICAL_SUPERVISOR: "/dashboard/clinical-supervisor",
    CLINICAL_PRECEPTOR: "/dashboard/clinical-preceptor",
    STUDENT: "/dashboard/student",
    SYSTEM: "/dashboard/admin", // System role uses admin dashboard
  }

  return baseRoutes[role] || "/dashboard"
}

/**
 * Multi-tenant data isolation middleware
 */
export async function withSchoolIsolation<T>(
  operation: (context: SchoolContext) => Promise<T>
): Promise<T> {
  const context = await getSchoolContext()

  try {
    return await operation(context)
  } catch (error) {
    console.error("School isolation error:", error)
    throw error
  }
}

/**
 * School switching for super admins
 */
export async function switchSchoolContext(targetSchoolId: string) {
  const context = await getSchoolContext()

  if (!context.canAccessAllSchools) {
    throw new Error("Only super admins can switch school context")
  }

  // Validate target school exists
  const [school] = await db.select().from(schools).where(eq(schools.id, targetSchoolId)).limit(1)

  if (!school) {
    throw new Error("Target school not found")
  }

  return school
}
