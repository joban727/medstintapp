import { logger } from "@/lib/logger"
import { eq } from "drizzle-orm"
import { type NextRequest } from "next/server"
import { db } from "@/database/connection-pool"
import { users, schools, programs, clinicalSites, rotations } from "@/database/schema"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
  ERROR_MESSAGES,
} from "@/lib/api-response"

/**
 * Quick Setup API - Auto-creates default entities for new users
 * This simplifies onboarding by ensuring users have the minimum needed to start
 */

// POST /api/quick-setup - Create default entities based on user role
export const POST = withErrorHandling(async (request: NextRequest) => {
  const authResult = await apiAuthMiddleware(request)
  if (!authResult.success || !authResult.user) {
    return createErrorResponse(
      authResult.error || "Unauthorized",
      authResult.status || HTTP_STATUS.UNAUTHORIZED
    )
  }

  const user = authResult.user

  const created: string[] = []
  const currentYear = new Date().getFullYear()

  try {
    // For SCHOOL_ADMIN: Auto-create default program and clinical site
    if (user.role === "SCHOOL_ADMIN" && user.schoolId) {
      // Check if school has any programs
      const existingPrograms = await db
        .select({ id: programs.id })
        .from(programs)
        .where(eq(programs.schoolId, user.schoolId))
        .limit(1)

      if (existingPrograms.length === 0) {
        // Only create default if NO programs exist (fallback)
        const defaultProgramId = crypto.randomUUID()
        await db.insert(programs).values({
          id: defaultProgramId,
          name: `Default Program (Class of ${currentYear + 1})`,
          description: "Auto-created default program. Edit or replace as needed.",
          duration: 12, // 12 months
          classYear: currentYear + 1,
          schoolId: user.schoolId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        created.push("Default Program")
      }

      // Check if there are any active clinical sites
      const existingSites = await db
        .select({ id: clinicalSites.id })
        .from(clinicalSites)
        .where(eq(clinicalSites.isActive, true))
        .limit(1)

      if (existingSites.length === 0) {
        // Create a placeholder clinical site
        const defaultSiteId = crypto.randomUUID()
        await db.insert(clinicalSites).values({
          id: defaultSiteId,
          name: "General Clinical Site (Placeholder)",
          address: "To be configured",
          phone: "000-000-0000",
          email: "admin@example.com",
          type: "CLINIC",
          capacity: 50,
          specialties: JSON.stringify(["General Medicine"]),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        created.push("Placeholder Clinical Site")
      }
    }

    // For STUDENT: Auto-create placeholder rotation if none exists
    if (user.role === "STUDENT" && user.schoolId) {
      // Use transaction for atomicity
      await db.transaction(async (tx) => {
        // Check if student has any rotations
        const existingRotations = await tx
          .select({ id: rotations.id })
          .from(rotations)
          .where(eq(rotations.studentId, user.id))
          .limit(1)

        if (existingRotations.length === 0) {
          // Find or create a clinical site
          let [site] = await tx
            .select({ id: clinicalSites.id })
            .from(clinicalSites)
            .where(eq(clinicalSites.isActive, true))
            .limit(1)

          if (!site) {
            // Create a placeholder site
            const siteId = crypto.randomUUID()
            await tx.insert(clinicalSites).values({
              id: siteId,
              name: "General Clinical Site (Auto-created)",
              address: "To be configured",
              phone: "000-000-0000",
              email: "admin@example.com",
              type: "CLINIC",
              capacity: 50,
              specialties: JSON.stringify(["General Medicine"]),
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            site = { id: siteId }
            created.push("Placeholder Clinical Site")
          }

          // Find the school's default program and link student to it
          const [defaultProgram] = await tx
            .select({ id: programs.id })
            .from(programs)
            .where(eq(programs.schoolId, user.schoolId!))
            .limit(1)

          if (defaultProgram && !user.programId) {
            // Link student to program
            await tx
              .update(users)
              .set({ programId: defaultProgram.id, updatedAt: new Date() })
              .where(eq(users.id, user.id))
            created.push("Student-Program Link")
          }

          // Create a default rotation for the student
          const startDate = new Date()
          const endDate = new Date()
          endDate.setMonth(endDate.getMonth() + 3) // 3 months from now

          await tx.insert(rotations).values({
            id: crypto.randomUUID(),
            studentId: user.id,
            clinicalSiteId: site.id,
            preceptorId: null, // No preceptor required
            specialty: "Clinical Experience",
            startDate,
            endDate,
            requiredHours: 160,
            completedHours: 0,
            status: "ACTIVE",
            objectives: JSON.stringify(["Complete clinical hours", "Gain practical experience"]),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          created.push("Default Rotation")
        }
      })
    }

    return createSuccessResponse(
      {
        created,
        message:
          created.length > 0
            ? `Successfully created: ${created.join(", ")}`
            : "All defaults already exist",
      },
      created.length > 0 ? "Quick setup completed" : "No setup needed"
    )
  } catch (error) {
    logger.error({ error }, "Quick setup error")
    return createErrorResponse("Failed to complete quick setup", HTTP_STATUS.INTERNAL_SERVER_ERROR)
  }
})
