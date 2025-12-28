import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest } from "next/server"
import { db } from "@/database/connection-pool"
import {
  users,
  schools,
  programs,
  cohorts,
  clinicalSites,
  rotations,
  programClinicalSites,
  onboardingSessions,
} from "@/database/schema"
import { apiAuthMiddleware } from "@/lib/rbac-middleware"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "@/lib/api-response"
import { invalidateUserCache } from "@/lib/auth-utils"

/**
 * Onboarding Complete API
 * Finalizes the onboarding process by:
 * 1. Persisting any temporary session data to real tables (if session exists)
 * 2. Marking the user's onboarding as complete
 * 
 * The API will succeed even if no session data exists - it just marks onboarding complete.
 */
export const POST = withErrorHandling(async (request: NextRequest) => {
  const authResult = await apiAuthMiddleware(request)
  if (!authResult.success || !authResult.user) {
    return createErrorResponse(
      authResult.error || "Unauthorized",
      authResult.status || HTTP_STATUS.UNAUTHORIZED
    )
  }

  const user = authResult.user

  // 1. Fetch Onboarding Session Data (optional - may not exist for simple onboarding flow)
  const [session] = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.userId, user.id))
    .limit(1)

  // If no session or no form data, just mark onboarding as complete and return
  // This handles the case where the simple OnboardingFlow component is used
  // (which doesn't create session data, just updates user directly)
  if (!session || !session.formData) {
    // Just mark user as onboarded
    await db
      .update(users)
      .set({
        onboardingCompleted: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))

    // Invalidate middleware cache so user gets redirected to dashboard immediately
    invalidateUserCache(user.id)

    return createSuccessResponse(
      {
        message: "Onboarding completed successfully",
        created: [],
      },
      "Onboarding Complete"
    )
  }

  const formData = session.formData as any
  const createdEntities: string[] = []

  try {
    await db.transaction(async (tx) => {
      // 2. Update School Profile
      if (formData.schoolProfile && user.schoolId) {
        await tx
          .update(schools)
          .set({
            name: formData.schoolProfile.name,
            address: formData.schoolProfile.address,
            phone: formData.schoolProfile.phone,
            website: formData.schoolProfile.website,
            updatedAt: new Date(),
          })
          .where(eq(schools.id, user.schoolId))
        createdEntities.push("School Profile")
      }

      // 3. Create Programs & Cohorts
      const programMap = new Map<string, string>() // Temp ID -> Real ID

      if (Array.isArray(formData.programs)) {
        for (const prog of formData.programs) {
          const programId = crypto.randomUUID()
          programMap.set(prog.id, programId) // Map temp ID from UI to new DB ID

          // Create Program
          await tx.insert(programs).values({
            id: programId,
            schoolId: user.schoolId!,
            name: prog.name,
            type: prog.type, // Save the program type
            description: prog.description || "",
            duration: parseInt(prog.duration) || 12, // Default to 12 months if invalid
            classYear: 0, // Legacy field, can be 0 or ignored
            isActive: true,
            requirements: JSON.stringify(prog.requirements || []),
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          createdEntities.push(`Program: ${prog.name}`)

          // Create Cohorts (Class Years)
          if (Array.isArray(prog.classYears)) {
            for (const cls of prog.classYears) {
              const cohortId = crypto.randomUUID()
              // Calculate dates based on "Year" (assuming academic year starts in Fall)
              // This is a simplification; ideally UI provides exact dates.
              const startYear = cls.year - Math.ceil(parseInt(prog.duration) / 12)
              const startDate = new Date(startYear, 8, 1) // Sept 1st
              const endDate = new Date(cls.year, 5, 30) // June 30th of grad year

              await tx.insert(cohorts).values({
                id: cohortId,
                programId: programId,
                name: cls.name || `Class of ${cls.year}`,
                startDate: startDate,
                endDate: endDate,
                capacity: parseInt(cls.capacity) || 0,
                description: cls.description,
                status: "ACTIVE",
                createdAt: new Date(),
                updatedAt: new Date(),
              })
              createdEntities.push(`Cohort: ${cls.name}`)
            }
          }
        }
      }

      // 4. Create Rotations (Templates or Active)
      // Note: The UI currently creates "Rotations" which might be templates or actual scheduled rotations.
      // For now, we'll treat them as templates if they don't have dates, or active if they do.
      // However, the current UI for rotations might be limited.
      // If the user added rotations in the wizard, we persist them.
      if (Array.isArray(formData.rotations)) {
        for (const rot of formData.rotations) {
          // We need a clinical site. If one exists in the form, use it, otherwise create placeholder.
          // The UI might have "siteId" if selected from existing, or "siteName" if new.
          // For simplicity in this "fix", we'll check if we need to create a site.

          let siteId = rot.siteId
          if (!siteId && rot.siteName) {
            const newSiteId = crypto.randomUUID()
            await tx.insert(clinicalSites).values({
              id: newSiteId,
              schoolId: user.schoolId,
              name: rot.siteName,
              address: rot.address || "Address Pending",
              phone: rot.phone || "Phone Pending",
              email: rot.email || "pending@example.com",
              type: rot.type || "HOSPITAL",
              capacity: rot.capacity ? parseInt(rot.capacity) : 0,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            siteId = newSiteId
            createdEntities.push(`Clinical Site: ${rot.siteName}`)
          }

          const linkedProgramId = programMap.get(rot.programId)

          if (siteId && linkedProgramId) {
            // Link to program
            await tx.insert(programClinicalSites).values({
              id: crypto.randomUUID(),
              schoolId: user.schoolId!,
              programId: linkedProgramId,
              clinicalSiteId: siteId,
              capacityOverride: rot.capacity ? parseInt(rot.capacity) : undefined,
              isDefault: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            createdEntities.push(`Program Site Link: ${rot.name}`)
          }
        }
      }

      // 5. Mark User as Onboarded
      await tx
        .update(users)
        .set({
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
    })

    // Invalidate middleware cache so user gets redirected to dashboard immediately
    invalidateUserCache(user.id)

    return createSuccessResponse(
      {
        message: "Onboarding completed successfully",
        created: createdEntities,
      },
      "Setup Finalized"
    )
  } catch (error) {
    console.error("Onboarding completion error:", error)
    return createErrorResponse(
      "Failed to finalize onboarding. Please try again.",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    )
  }
})

