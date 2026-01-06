import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import { onboardingSessions, users, schools, programs } from "../../../../database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"
import {
  createSuccessResponse,
  createErrorResponse,
  withErrorHandling,
  HTTP_STATUS,
} from "@/lib/api-response"
import { invalidateUserCache } from "@/lib/auth-utils"

// GET - Retrieve onboarding progress
export const GET = withErrorHandling(async () => {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    return createErrorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED)
  }

  // Get current onboarding session
  const [session] = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.userId, clerkUser.id))
    .orderBy(onboardingSessions.createdAt)
    .limit(1)

  if (!session) {
    return createSuccessResponse({
      currentStep: 1,
      completedSteps: [],
      formData: {},
      isCompleted: false,
    })
  }

  // Calculate completion status based on current step
  const isCompleted = session.currentStep === "completed"

  return createSuccessResponse({
    currentStep: session.currentStep,
    completedSteps: session.completedSteps || [],
    formData: session.formData || {},
    isCompleted,
  })
})

// POST - Save onboarding progress
export const POST = withErrorHandling(async (request: NextRequest) => {
  const clerkUser = await currentUser()

  if (!clerkUser) {
    return createErrorResponse("Unauthorized", HTTP_STATUS.UNAUTHORIZED)
  }

  const body = await request.json()
  const { currentStep, completedSteps, formData, isCompleted } = body

  // Validate and convert currentStep to string
  const stepNumber = typeof currentStep === "string" ? Number.parseInt(currentStep) : currentStep
  if (typeof stepNumber !== "number" || stepNumber < 1 || stepNumber > 6) {
    return createErrorResponse("Invalid current step", HTTP_STATUS.BAD_REQUEST)
  }
  const currentStepString = stepNumber.toString()

  // Check if session exists
  const [existingSession] = await db
    .select()
    .from(onboardingSessions)
    .where(eq(onboardingSessions.userId, clerkUser.id))
    .limit(1)

  const sessionData = {
    userId: clerkUser.id,
    currentStep: currentStepString,
    completedSteps: completedSteps || [],
    formData: formData || {},
    updatedAt: new Date(),
  }

  if (existingSession) {
    // Merge existing formData with new formData
    const mergedFormData = {
      ...(existingSession.formData as Record<string, any>),
      ...(formData || {}),
    }

    // Update existing session
    await db
      .update(onboardingSessions)
      .set({
        ...sessionData,
        formData: mergedFormData,
      })
      .where(eq(onboardingSessions.userId, clerkUser.id))
  } else {
    // Create new session
    await db.insert(onboardingSessions).values({
      ...sessionData,
      createdAt: new Date(),
    })
  }

  // If onboarding is completed, persist data and update user
  if (isCompleted) {
    const fullFormData = {
      ...((existingSession?.formData as Record<string, any>) || {}),
      ...(formData || {}),
    }

    const schoolData = fullFormData.schoolProfile
    const programsData = fullFormData.programs

    if (schoolData) {
      // Create School
      const schoolId = crypto.randomUUID()
      await db.insert(schools).values({
        id: schoolId,
        name: schoolData.name,
        address: `${schoolData.address}, ${schoolData.city}, ${schoolData.state} ${schoolData.zipCode}`,
        phone: schoolData.phone,
        email: schoolData.email,
        // map city, state, zip to address or separate fields if schema supports it
        // schema only has address, so we might append them or just use address
        adminId: clerkUser.id,
      })

      // Create Programs
      if (programsData && Array.isArray(programsData)) {
        for (const prog of programsData) {
          await db.insert(programs).values({
            id: crypto.randomUUID(),
            schoolId: schoolId,
            name: prog.name,
            type: prog.type,
            description: prog.name, // Default description
            duration: (parseInt(prog.duration) || 1) * 12, // Convert years to months
            classYear: new Date().getFullYear() + (parseInt(prog.duration) || 1), // Estimate
          })
        }
      }

      // Update User
      await db
        .update(users)
        .set({
          onboardingCompleted: true,
          schoolId: schoolId,
        })
        .where(eq(users.id, clerkUser.id))
    } else {
      // Fallback if no school data (shouldn't happen if flow is followed)
      await db.update(users).set({ onboardingCompleted: true }).where(eq(users.id, clerkUser.id))
    }

    // Invalidate middleware cache so user gets redirected to dashboard immediately
    invalidateUserCache(clerkUser.id)
  }

  // Invalidate related caches
  try {
    await cacheIntegrationService.invalidateByTags(["onboarding"])
  } catch (cacheError) {
    console.warn("Cache invalidation error in onboarding/progress/route.ts:", cacheError)
  }

  return createSuccessResponse({ success: true })
})
