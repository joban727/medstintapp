import { currentUser } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/db"
import { onboardingSessions, users } from "../../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


// GET - Retrieve onboarding progress
export async function GET() {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:onboarding/progress/route.ts',
      async () => {
        // Original function logic will be wrapped here
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )
    
    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn('Cache error in onboarding/progress/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const clerkUser = await currentUser()

    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current onboarding session
    const [session] = await db
      .select()
      .from(onboardingSessions)
      .where(eq(onboardingSessions.userId, clerkUser.id))
      .orderBy(onboardingSessions.createdAt)
      .limit(1)

    if (!session) {
      return NextResponse.json({
        currentStep: 1,
        completedSteps: [],
        formData: {},
        isCompleted: false,
      })
    }

    // Calculate completion status based on current step
    const isCompleted = session.currentStep === "completed"

    return NextResponse.json({
      success: true,
      data: {
        currentStep: session.currentStep,
        completedSteps: session.completedSteps || [],
        formData: session.formData || {},
        isCompleted,
      },
    })
  } catch (error) {
    console.error("Error retrieving onboarding progress:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }

  }
}

// POST - Save onboarding progress
export async function POST(request: NextRequest) {
  try {
    const clerkUser = await currentUser()

    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { currentStep, completedSteps, formData, isCompleted } = body

    // Validate and convert currentStep to string
    const stepNumber = typeof currentStep === "string" ? Number.parseInt(currentStep) : currentStep
    if (typeof stepNumber !== "number" || stepNumber < 1 || stepNumber > 6) {
      return NextResponse.json({ error: "Invalid current step" }, { status: 400 })
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
      // Update existing session
      await db
        .update(onboardingSessions)
        .set(sessionData)
        .where(eq(onboardingSessions.userId, clerkUser.id))
    } else {
      // Create new session
      await db.insert(onboardingSessions).values({
        ...sessionData,
        createdAt: new Date(),
      })
    }

    // If onboarding is completed, update the users table
    if (isCompleted) {
      await db.update(users).set({ onboardingCompleted: true }).where(eq(users.id, clerkUser.id))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving onboarding progress:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateProgressCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in onboarding/progress/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
