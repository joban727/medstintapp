"use server"

import { db } from "@/database/connection-pool"
import { cohorts } from "@/database/schema"
import { eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { v4 as uuidv4 } from "uuid"

const cohortSchema = z.object({
    name: z.string().min(1, "Name is required"),
    programId: z.string().min(1, "Program ID is required"),
    startDate: z.string().or(z.date()),
    endDate: z.string().or(z.date()),
    capacity: z.coerce.number().min(1),
    description: z.string().optional(),
})

export async function getCohorts(programId: string) {
    try {
        const data = await db
            .select()
            .from(cohorts)
            .where(eq(cohorts.programId, programId))
            .orderBy(desc(cohorts.startDate))
        return { success: true, data }
    } catch (error) {
        console.error("Failed to fetch cohorts:", error)
        return { success: false, error: "Failed to fetch cohorts" }
    }
}

export async function createCohort(data: z.infer<typeof cohortSchema>) {
    try {
        const validated = cohortSchema.parse(data)
        const [newCohort] = await db.insert(cohorts).values({
            id: uuidv4(),
            programId: validated.programId,
            name: validated.name,
            startDate: new Date(validated.startDate),
            endDate: new Date(validated.endDate),
            capacity: validated.capacity,
            description: validated.description,
            status: "ACTIVE",
        }).returning()

        revalidatePath("/dashboard/school-admin/programs")
        return { success: true, data: newCohort }
    } catch (error) {
        console.error("Failed to create cohort:", error)
        return { success: false, error: "Failed to create cohort" }
    }
}

export async function updateCohort(id: string, data: Partial<z.infer<typeof cohortSchema>>) {
    try {
        const [updatedCohort] = await db
            .update(cohorts)
            .set({
                ...data,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined,
                updatedAt: new Date(),
            })
            .where(eq(cohorts.id, id))
            .returning()

        revalidatePath("/dashboard/school-admin/programs")
        return { success: true, data: updatedCohort }
    } catch (error) {
        console.error("Failed to update cohort:", error)
        return { success: false, error: "Failed to update cohort" }
    }
}

export async function deleteCohort(id: string) {
    try {
        await db.delete(cohorts).where(eq(cohorts.id, id))
        revalidatePath("/dashboard/school-admin/programs")
        return { success: true }
    } catch (error) {
        console.error("Failed to delete cohort:", error)
        return { success: false, error: "Failed to delete cohort" }
    }
}
