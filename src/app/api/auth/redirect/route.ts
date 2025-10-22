import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getUserById } from "../../../../lib/rbac-middleware"
import { cacheIntegrationService } from '@/lib/cache-integration'


export async function GET(_request: Request) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:auth/redirect/route.ts',
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
    console.warn('Cache error in auth/redirect/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"

  try {
    // Check environment variables first
    const secretKey = process.env.CLERK_SECRET_KEY
    const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

    if (
      !secretKey ||
      !publishableKey ||
      secretKey.includes("placeholder") ||
      publishableKey.includes("placeholder")
    ) {
      console.error("❌ Invalid Clerk keys detected in redirect handler")
      return NextResponse.redirect(new URL("/auth/sign-in?error=config", baseUrl))
    }

    // Get the authenticated user with timeout
    const authPromise = auth()
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Auth timeout")), 5000)
    )

    const { userId } = (await Promise.race([authPromise, timeoutPromise])) as {
      userId: string | null
    }

    if (!userId) {
      return NextResponse.redirect(new URL("/auth/sign-in", baseUrl))
    }

    // Check if user exists in database and has completed onboarding
    const user = await getUserById(userId)

    if (!user) {
      return NextResponse.redirect(new URL("/onboarding/user-type", baseUrl))
    }

    if (!user.onboardingCompleted) {
      return NextResponse.redirect(new URL("/onboarding/user-type", baseUrl))
    }

    // User is authenticated and has completed onboarding
    // Redirect to role-based dashboard
    const dashboardPath = getDashboardPathForRole(user.role)

    return NextResponse.redirect(new URL(dashboardPath, baseUrl))
  } catch (error) {
    console.error("❌ Redirect handler error:", error)

    // Provide more specific error handling
    if (error instanceof Error) {
      if (error.message.includes("timeout")) {
        console.error("❌ Authentication timeout")
        return NextResponse.redirect(new URL("/auth/sign-in?error=timeout", baseUrl))
      }
      if (error.message.includes("CLERK_SECRET_KEY")) {
        console.error("❌ Clerk configuration error")
        return NextResponse.redirect(new URL("/auth/sign-in?error=config", baseUrl))
      }
    }

    // On any other error, redirect to sign-in with error parameter
    return NextResponse.redirect(new URL("/auth/sign-in?error=server", baseUrl))
  }

  }
}

function getDashboardPathForRole(role: string): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/dashboard/admin"
    case "SCHOOL_ADMIN":
      return "/dashboard/school-admin"
    case "CLINICAL_SUPERVISOR":
      return "/dashboard/clinical-supervisor"
    case "CLINICAL_PRECEPTOR":
      return "/dashboard/clinical-preceptor"
    case "STUDENT":
      return "/dashboard/student"
    default:
      return "/dashboard"
  }
}
