"use server"

import { count, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import { schools, users } from "../database/schema"
import { getCurrentUser } from "../lib/auth-clerk"
import { logAuditEvent } from "../lib/rbac-middleware"
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
import {
  getSchoolFilteredUsers,
  validateSchoolAccess,
  withSchoolIsolation,
} from "../lib/school-utils"

// Validation schemas
const userProfileSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  image: z.string().optional(),
  avatar: z.string().optional(),
})

// Note:    // For now, we'll just check if the user exists in our MedStint tables that need to be added to schema.ts
const timeRecordSchema = z.object({
  date: z.string(),
  hoursWorked: z.number().min(0.5).max(24),
  description: z.string().min(10, "Description must be at least 10 characters"),
  supervisorId: z.string().uuid(),
})

// User Profile Actions
export async function updateUserProfile(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth/sign-in")
  }

  try {
    const data = {
      name: formData.get("name") as string | null,
      email: formData.get("email") as string | null,
      image: formData.get("image") as string | null,
      avatar: formData.get("avatar") as string | null,
    }

    const validatedData = userProfileSchema.parse(data)

    // Using Drizzle ORM for type safety
    await db
      .update(users)
      .set({
        name: validatedData.name,
        email: validatedData.email,
        image: validatedData.image,
        avatar: validatedData.avatar,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))

    revalidatePath("/dashboard/settings")
    return { success: true, message: "Profile updated successfully" }
  } catch (error) {
    console.error("Profile update error:", error)
    return { success: false, message: "Failed to update profile" }
  }
}

export async function getUserProfile() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth/sign-in")
  }

  try {
    const [userProfile] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        schoolId: users.schoolId,
        department: users.department,
        phone: users.phone,
        address: users.address,
        isActive: users.isActive,
        studentId: users.studentId,
        programId: users.programId,
        enrollmentDate: users.enrollmentDate,
        expectedGraduation: users.expectedGraduation,
        academicStatus: users.academicStatus,
        gpa: users.gpa,
        totalClinicalHours: users.totalClinicalHours,
        completedRotations: users.completedRotations,
        onboardingCompleted: users.onboardingCompleted,
        avatar: users.avatar,
        avatarUrl: users.avatarUrl,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)

    return userProfile
  } catch (error) {
    console.error("Get user profile error:", error)
    throw new Error("Failed to fetch user profile")
  }
}

export async function getAllUsers() {
  return withSchoolIsolation(async (context) => {
    try {
      // Log access attempt
      await logAuditEvent({
        userId: context.userId,
        action: "VIEW_USERS",
        resource: "users",
        details: { message: `Accessed user list for school: ${context.schoolId || "all"}` },
        severity: "LOW",
      })

      // Get users filtered by school context
      const allUsers = await getSchoolFilteredUsers(context)
      return allUsers
    } catch (error) {
      console.error("Get all users error:", error)
      throw new Error("Failed to fetch users")
    }
  })
}

// School-aware user management
export async function getUsersBySchool(schoolId?: string) {
  return withSchoolIsolation(async (context) => {
    const targetSchoolId = schoolId || context.schoolId

    if (!targetSchoolId) {
      throw new Error("School ID is required")
    }

    // Validate access to the target school
    validateSchoolAccess(targetSchoolId, context)

    try {
      const schoolUsers = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          department: users.department,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.schoolId, targetSchoolId))
        .orderBy(users.createdAt)

      return schoolUsers
    } catch (error) {
      console.error("Get users by school error:", error)
      throw new Error("Failed to fetch school users")
    }
  })
}

// Get schools accessible to current user
export async function getAccessibleSchools() {
  return withSchoolIsolation(async (context) => {
    try {
      // School admins can only see their own school
      let accessibleSchools: (typeof schools.$inferSelect)[]
      if (context.userRole === "SCHOOL_ADMIN" && context.schoolId) {
        accessibleSchools = await db
          .select()
          .from(schools)
          .where(eq(schools.id, context.schoolId))
          .orderBy(schools.name)
      } else {
        accessibleSchools = await db.select().from(schools).orderBy(schools.name)
      }

      return accessibleSchools
    } catch (error) {
      console.error("Get accessible schools error:", error)
      throw new Error("Failed to fetch schools")
    }
  })
}
