"use server"

import { db } from "@/database/connection-pool"
import { schools, programs, cohorts, users } from "@/database/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getCurrentUser } from "@/lib/auth-clerk"

/**
 * Quick setup action for SCHOOL_ADMIN users who don't have a school yet.
 * Creates a default school, program, and cohort so the user can start inviting students.
 */
export async function quickSetup(schoolName: string, programName: string) {
    const user = await getCurrentUser()

    if (!user) {
        return { success: false, error: "Not authenticated" }
    }

    if (user.role !== "SCHOOL_ADMIN") {
        return { success: false, error: "Only school admins can use quick setup" }
    }

    // Check if user already has a school
    if (user.schoolId) {
        return { success: false, error: "You already have a school set up" }
    }

    try {
        // Create school
        const schoolId = crypto.randomUUID()
        await db.insert(schools).values({
            id: schoolId,
            name: schoolName || "My School",
            address: "",
            phone: "",
            email: user.email || "",
            adminId: user.id,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        // Update user with schoolId
        await db
            .update(users)
            .set({
                schoolId,
                updatedAt: new Date()
            })
            .where(eq(users.id, user.id))

        // Create default program
        const programId = crypto.randomUUID()
        const currentYear = new Date().getFullYear()
        const graduationYear = currentYear + 2 // Default 2-year program

        await db.insert(programs).values({
            id: programId,
            schoolId,
            name: programName || "Radiology Technology Program",
            description: "Default program created during quick setup",
            duration: 24, // 24 months default
            classYear: graduationYear,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        // Create default cohort
        const cohortId = crypto.randomUUID()
        await db.insert(cohorts).values({
            id: cohortId,
            programId,
            name: `Class of ${graduationYear}`,
            startDate: new Date(),
            endDate: new Date(graduationYear, 5, 30), // June 30th of graduation year
            capacity: 50,
            status: "ACTIVE",
            description: "Default cohort created during quick setup",
            createdAt: new Date(),
            updatedAt: new Date(),
        })

        revalidatePath("/dashboard/school-admin")
        revalidatePath("/dashboard/school-admin/setup")
        revalidatePath("/dashboard/school-admin/programs")

        return {
            success: true,
            data: {
                schoolId,
                programId,
                cohortId,
                schoolName: schoolName || "My School",
                programName: programName || "Radiology Technology Program",
                cohortName: `Class of ${graduationYear}`
            }
        }
    } catch (error) {
        console.error("Quick setup error:", error)
        return { success: false, error: "Failed to complete quick setup" }
    }
}
