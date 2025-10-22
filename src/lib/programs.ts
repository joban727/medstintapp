// Use Web Crypto API for browser compatibility
const randomUUID =
  typeof window !== "undefined"
    ? () => window.crypto.randomUUID()
    : require("node:crypto").randomUUID

import { and, count, desc, eq, like } from "drizzle-orm"
import { db } from "@/database/db"
import { programs, users } from "@/database/schema"
import { getSchoolContext } from "@/lib/school-utils"

export interface Program {
  id: string
  name: string
  description: string
  duration: number | null
  classYear: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date | null
  stats?: {
    totalStudents: number
  }
}

/**
 * Get programs for a specific school with optional statistics
 */
export async function getSchoolPrograms(
  schoolId: string,
  options: {
    includeStats?: boolean
    search?: string
    isActive?: boolean
    limit?: number
    offset?: number
  } = {}
): Promise<Program[]> {
  const { includeStats = true, search, isActive, limit = 50, offset = 0 } = options

  // Build query conditions
  const conditions = [eq(programs.schoolId, schoolId)]

  if (search) {
    conditions.push(like(programs.name, `%${search}%`))
  }

  if (isActive !== undefined) {
    conditions.push(eq(programs.isActive, isActive))
  }

  if (includeStats) {
    // Query with student count statistics
    const programsWithStats = await db
      .select({
        id: programs.id,
        name: programs.name,
        description: programs.description,
        duration: programs.duration,
        classYear: programs.classYear,
        isActive: programs.isActive,
        createdAt: programs.createdAt,
        updatedAt: programs.updatedAt,
        studentCount: count(users.id),
      })
      .from(programs)
      .leftJoin(users, eq(users.programId, programs.id))
      .where(and(...conditions))
      .groupBy(programs.id)
      .orderBy(desc(programs.createdAt))
      .limit(limit)
      .offset(offset)

    return programsWithStats.map((program) => ({
      ...program,
      stats: {
        totalStudents: program.studentCount,
      },
    }))
  }
  // Query without statistics for better performance
  const programsData = await db
    .select({
      id: programs.id,
      name: programs.name,
      description: programs.description,
      duration: programs.duration,
      classYear: programs.classYear,
      isActive: programs.isActive,
      createdAt: programs.createdAt,
      updatedAt: programs.updatedAt,
    })
    .from(programs)
    .where(and(...conditions))
    .orderBy(desc(programs.createdAt))
    .limit(limit)
    .offset(offset)

  return programsData
}

/**
 * Get programs accessible to the current user with school context validation
 */
export async function getUserAccessiblePrograms(
  options: {
    includeStats?: boolean
    search?: string
    isActive?: boolean
    limit?: number
    offset?: number
  } = {}
): Promise<Program[]> {
  const context = await getSchoolContext()

  if (!context.schoolId && !context.canAccessAllSchools) {
    throw new Error("User must be associated with a school to access programs")
  }

  if (context.canAccessAllSchools) {
    // Super admin can see all programs - would need different implementation
    // For now, return empty array or implement cross-school query
    return []
  }

  if (!context.schoolId) {
    throw new Error("User must be associated with a school to access programs")
  }

  return getSchoolPrograms(context.schoolId, options)
}

/**
 * Create a new program
 */
export async function createProgram(data: {
  name: string
  description: string
  duration: number
  schoolId: string
  requirements?: string
}) {
  const context = await getSchoolContext()

  // Validate school access
  if (!context.canAccessAllSchools && context.schoolId !== data.schoolId) {
    throw new Error("Unauthorized: Cannot create program for this school")
  }

  // Calculate class year based on current year + program duration
  const currentYear = new Date().getFullYear()
  const classYear = currentYear + data.duration

  // Format program name with class year
  const programNameWithClass = `${data.name} - Class of ${classYear}`

  const [newProgram] = await db
    .insert(programs)
    .values({
      id: randomUUID(),
      name: programNameWithClass,
      description: data.description,
      duration: data.duration,
      classYear,
      schoolId: data.schoolId,
      requirements: data.requirements || null,
    })
    .returning()

  return newProgram
}
