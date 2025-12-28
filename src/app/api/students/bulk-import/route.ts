import { type NextRequest } from "next/server"
import { z } from "zod"
import { db } from "@/database/connection-pool"
import { users, programs } from "@/database/schema"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "@/lib/api-response"
import { eq } from "drizzle-orm"

const studentImportSchema = z.array(
  z.object({
    name: z.string().min(1),
    email: z.string().email(),
    studentId: z.string().optional(),
  })
)

export const POST = withErrorHandling(async (request: NextRequest) => {
  const authResult = await apiAuthMiddleware(request)
  if (!authResult.success || !authResult.user || authResult.user.role !== "SCHOOL_ADMIN") {
    return createErrorResponse(
      authResult.error || "Unauthorized",
      authResult.status || HTTP_STATUS.UNAUTHORIZED
    )
  }

  const body = await request.json()
  const validation = studentImportSchema.safeParse(body)

  if (!validation.success) {
    return createErrorResponse("Invalid data format", HTTP_STATUS.BAD_REQUEST, validation.error)
  }

  const students = validation.data
  const schoolId = authResult.user.schoolId!

  // Get default program
  const defaultProgram = await db.query.programs.findFirst({
    where: eq(programs.schoolId, schoolId),
  })

  if (!defaultProgram) {
    return createErrorResponse(
      "No default program found. Please run quick setup first.",
      HTTP_STATUS.BAD_REQUEST
    )
  }

  const createdCount = 0
  const errors: string[] = []

  // Process sequentially to handle errors gracefully
  // In a real prod env, we might use a bulk insert with ON CONFLICT DO NOTHING,
  // but we want to return specific errors for duplicates if possible or just skip them.
  // For simplicity and safety, we'll check and insert.

  const results = await Promise.all(
    students.map(async (student) => {
      try {
        const existing = await db.query.users.findFirst({
          where: eq(users.email, student.email),
        })

        if (existing) {
          return { status: "skipped", email: student.email, reason: "Email already exists" }
        }

        await db.insert(users).values({
          id: crypto.randomUUID(),
          name: student.name,
          email: student.email,
          role: "STUDENT",
          schoolId: schoolId,
          programId: defaultProgram.id,
          isActive: true,
          emailVerified: false, // Will need to verify via email
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        return { status: "created", email: student.email }
      } catch (error) {
        console.error(`Failed to import student ${student.email}:`, error)
        return { status: "error", email: student.email, reason: "Database error" }
      }
    })
  )

  const created = results.filter((r) => r.status === "created").length
  const skipped = results.filter((r) => r.status === "skipped").length
  const failed = results.filter((r) => r.status === "error").length

  return createSuccessResponse(
    {
      created,
      skipped,
      failed,
      details: results,
    },
    `Imported ${created} students. ${skipped} skipped, ${failed} failed.`
  )
})

