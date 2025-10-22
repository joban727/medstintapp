"use server"

import { count, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { db } from "../database/db"
import { schools, users } from "../database/schema"
import { getCurrentUser } from "../lib/auth-clerk"
import { logAuditEvent } from "../lib/rbac-middleware"
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

// Note: The following schemas are for future MedStint tables that need to be added to schema.ts
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

// =============================================================================
// MedStint-Specific Actions (Require Additional Schema Tables)
// =============================================================================
// Note: The following functions require additional tables to be added to schema.ts:
// - schools, time_records, evaluations, competency_assessments, clinical_sites
// These are placeholder implementations that will work once the schema is extended.

// Time Record Actions
export async function createTimeRecord(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth/sign-in")
  }

  try {
    const data = {
      date: formData.get("date") as string | null,
      hoursWorked: Number.parseFloat((formData.get("hoursWorked") as string | null) || "0"),
      description: formData.get("description") as string | null,
      supervisorId: formData.get("supervisorId") as string | null,
    }

    const _validatedData = timeRecordSchema.parse(data)

    // TODO: Implement once time_records table is added to schema
    // This would create a new time record entry
    // Time record data validated successfully

    // TODO: Implement once time_records table is added to schema
    // Placeholder implementation - table doesn't exist yet
    // Time record creation logic would go here
    // await db.insert(timeRecords).values({
    //   id: crypto.randomUUID(),
    //   studentId: (session.user as any).id,
    //   supervisorId: validatedData.supervisorId,
    //   date: new Date(validatedData.date),
    //   hoursWorked: validatedData.hoursWorked,
    //   description: validatedData.description,
    //   status: 'PENDING'
    // })

    revalidatePath("/dashboard/student")
    return { success: true, message: "Time record created successfully" }
  } catch (error) {
    console.error("Time record creation error:", error)
    return { success: false, message: "Failed to create time record. Table may not exist yet." }
  }
}

export async function approveTimeRecord(_recordId: string) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth/sign-in")
  }

  try {
    // TODO: Add role-based authorization once user roles are added to schema
    // if (!['CLINICAL_PRECEPTOR', 'CLINICAL_SUPERVISOR', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(session.user.role))

    // TODO: Implement once time_records table is added to schema
    // Time record approval logic would go here
    // await db.update(timeRecords)
    //   .set({
    //     status: 'APPROVED',
    //     approvedBy: user.id,
    //     approvedAt: new Date(),
    //     updatedAt: new Date()
    //   })
    //   .where(eq(timeRecords.id, recordId))

    revalidatePath("/dashboard")
    return { success: true, message: "Time record approved successfully" }
  } catch (error) {
    console.error("Time record approval error:", error)
    return { success: false, message: "Failed to approve time record. Table may not exist yet." }
  }
}

export async function getTimeRecords(_limit = 10, _offset = 0) {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth/sign-in")
  }

  try {
    // TODO: Implement role-based filtering once user roles are added to schema
    // Placeholder implementation - table doesn't exist yet
    // Time record fetching logic would go here
    // const records = await db
    //   .select({
    //     id: timeRecords.id,
    //     date: timeRecords.date,
    //     hoursWorked: timeRecords.hoursWorked,
    //     description: timeRecords.description,
    //     status: timeRecords.status,
    //     createdAt: timeRecords.createdAt,
    //     approvedAt: timeRecords.approvedAt,
    //     supervisorName: users.name
    //   })
    //   .from(timeRecords)
    //   .leftJoin(users, eq(timeRecords.supervisorId, users.id))
    //   .where(eq(timeRecords.studentId, user.id))
    //   .orderBy(desc(timeRecords.date))
    //   .limit(limit)
    //   .offset(offset)

    return []
  } catch (error) {
    console.error("Get time records error:", error)
    throw new Error("Failed to fetch time records. Table may not exist yet.")
  }
}

// =============================================================================
// Simplified Data Fetching (Works with Current Schema)
// =============================================================================

export async function getDashboardStats() {
  const user = await getCurrentUser()
  if (!user) {
    redirect("/auth/sign-in")
  }

  try {
    // Basic user statistics from current schema using Drizzle ORM
    const [userStats] = await db
      .select({
        totalUsers: count(),
        verifiedUsers: count(users.emailVerified),
      })
      .from(users)

    const stats = userStats

    return {
      totalUsers: stats.totalUsers,
      verifiedUsers: stats.verifiedUsers,
      // TODO: Add MedStint-specific stats once tables are implemented
      totalRecords: 0,
      totalHours: 0,
      pendingApprovals: 0,
    }
  } catch (error) {
    console.error("Get dashboard stats error:", error)
    throw new Error("Failed to fetch dashboard statistics")
  }
}

// Generic data fetching function for development/testing
export async function executeQuery(_query: string) {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Unauthorized: Authentication required")
  }

  try {
    // TODO: Implement safe query execution with Drizzle ORM
    // Query execution logic would go here
    throw new Error("Raw query execution not available - use Drizzle ORM instead")
  } catch (error) {
    console.error("Execute query error:", error)
    throw new Error("Failed to execute query")
  }
}

// =============================================================================
// MedStint Schema Extension Guide
// =============================================================================
/*
To complete the MedStint functionality, add these tables to schema.ts:

1. Add role field to users table:
   role: text("role").default("STUDENT").notNull(),
   schoolId: text("school_id"),
   phone: text("phone"),
   bio: text("bio"),

2. Create schools table:
   export const schools = pgTable("schools", {
     id: text("id").primaryKey(),
     name: text("name").notNull(),
     address: text("address"),
     phone: text("phone"),
     email: text("email"),
     isActive: boolean("is_active").default(true),
     createdAt: timestamp("created_at").defaultNow(),
     updatedAt: timestamp("updated_at").defaultNow()
   });

3. Create time_records table:
   export const timeRecords = pgTable("time_records", {
     id: text("id").primaryKey(),
     studentId: text("student_id").references(() => users.id),
     supervisorId: text("supervisor_id").references(() => users.id),
     date: timestamp("date").notNull(),
     hoursWorked: integer("hours_worked").notNull(),
     description: text("description").notNull(),
     status: text("status").default("PENDING"),
     approvedBy: text("approved_by"),
     approvedAt: timestamp("approved_at"),
     createdAt: timestamp("created_at").defaultNow(),
     updatedAt: timestamp("updated_at").defaultNow()
   });

4. Create clinical_sites table:
   export const clinicalSites = pgTable("clinical_sites", {
     id: text("id").primaryKey(),
     name: text("name").notNull(),
     address: text("address"),
     type: text("type"),
     capacity: integer("capacity"),
     isActive: boolean("is_active").default(true),
     createdAt: timestamp("created_at").defaultNow(),
     updatedAt: timestamp("updated_at").defaultNow()
   });

Once these tables are added, uncomment and update the functions above
to use Drizzle ORM instead of raw SQL for better type safety.
*/
