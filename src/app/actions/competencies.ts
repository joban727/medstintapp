"use server"

import { db } from "@/database/connection-pool"
import { competencies, competencyAssignments } from "@/database/schema"
import { eq, desc, count, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { v4 as uuidv4 } from "uuid"
import { getCurrentUser } from "@/lib/auth-clerk"

const competencySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  programId: z.string().min(1, "Program ID is required"),
  category: z.string().min(1, "Category is required"),
  level: z.enum(["FUNDAMENTAL", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
  isRequired: z.boolean().default(false),
})

export async function getCompetenciesByProgram(programId: string) {
  try {
    const data = await db
      .select({
        id: competencies.id,
        name: competencies.name,
        description: competencies.description,
        category: competencies.category,
        level: competencies.level,
        isRequired: competencies.isRequired,
        createdAt: competencies.createdAt,
      })
      .from(competencies)
      .where(eq(competencies.programId, programId))
      .orderBy(desc(competencies.createdAt))
    return { success: true, data }
  } catch (error) {
    console.error("Failed to fetch competencies:", error)
    return { success: false, error: "Failed to fetch competencies" }
  }
}

export async function createCompetency(data: z.infer<typeof competencySchema>) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return { success: false, error: "Unauthorized" }
    }

    const validated = competencySchema.parse(data)
    const [newCompetency] = await db
      .insert(competencies)
      .values({
        id: uuidv4(),
        name: validated.name,
        description: validated.description,
        programId: validated.programId,
        category: validated.category,
        level: validated.level,
        isRequired: validated.isRequired,
        schoolId: user.schoolId,
        createdBy: user.id,
        source: "CUSTOM",
        deploymentScope: "PROGRAM_SPECIFIC",
      })
      .returning()

    revalidatePath("/dashboard/school-admin/programs")
    return { success: true, data: newCompetency }
  } catch (error) {
    console.error("Failed to create competency:", error)
    return { success: false, error: "Failed to create competency" }
  }
}

export async function updateCompetency(
  id: string,
  data: Partial<z.infer<typeof competencySchema>>
) {
  try {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.category !== undefined) updateData.category = data.category
    if (data.level !== undefined) updateData.level = data.level
    if (data.isRequired !== undefined) updateData.isRequired = data.isRequired

    const [updatedCompetency] = await db
      .update(competencies)
      .set(updateData)
      .where(eq(competencies.id, id))
      .returning()

    revalidatePath("/dashboard/school-admin/programs")
    return { success: true, data: updatedCompetency }
  } catch (error) {
    console.error("Failed to update competency:", error)
    return { success: false, error: "Failed to update competency" }
  }
}

export async function deleteCompetency(id: string) {
  try {
    // Check if there are any assignments for this competency
    const [assignmentCount] = await db
      .select({ count: count() })
      .from(competencyAssignments)
      .where(eq(competencyAssignments.competencyId, id))

    if (assignmentCount && assignmentCount.count > 0) {
      return {
        success: false,
        error: "Cannot delete competency with existing student assignments. Archive it instead.",
      }
    }

    await db.delete(competencies).where(eq(competencies.id, id))
    revalidatePath("/dashboard/school-admin/programs")
    return { success: true }
  } catch (error) {
    console.error("Failed to delete competency:", error)
    return { success: false, error: "Failed to delete competency" }
  }
}

export async function getCompetencyCountByProgram(programId: string) {
  try {
    const [result] = await db
      .select({ count: count() })
      .from(competencies)
      .where(eq(competencies.programId, programId))
    return { success: true, count: result?.count || 0 }
  } catch (error) {
    console.error("Failed to get competency count:", error)
    return { success: false, count: 0 }
  }
}
