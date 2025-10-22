import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import type { NeonDatabase } from "drizzle-orm/neon-serverless"
import { NextResponse } from "next/server"

// Import db conditionally to avoid client-side bundling
let db: NeonDatabase<Record<string, never>> | undefined
let users: typeof import("./database/schema").users | undefined

if (typeof window === "undefined") {
  // Server-side imports
  const connectionPool = require("./database/connection-pool")
  const schema = require("./database/schema")
  db = connectionPool.db
  users = schema.users
}

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/auth(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/onboarding(.*)",
  "/api/webhooks(.*)",
  "/api/public(.*)",
  "/api/health(.*)",
  "/api/test(.*)",
  "/api/user/update",
  "/api/schools/create",
  "/terms",
  "/privacy",

  "/api/auth/debug",
  "/api/auth/redirect",
])

// Define API routes that handle their own authentication
const isApiRoute = createRouteMatcher(["/api/(.*)"])

// Define dashboard routes that require authentication
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"])

// Role-based access control function
function checkRoleBasedAccess(userRole: string, pathname: string): string | null {
  // Define role-specific route patterns
  const roleRoutes = {
    SUPER_ADMIN: ["/dashboard/admin"],
    SCHOOL_ADMIN: ["/dashboard/school-admin"],
    CLINICAL_SUPERVISOR: ["/dashboard/clinical-supervisor"],
    CLINICAL_PRECEPTOR: ["/dashboard/clinical-preceptor"],
    STUDENT: ["/dashboard/student"],
  }

  // Get the appropriate dashboard route for the user's role
  const getRoleDashboardRoute = (role: string): string => {
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

  // Check if user is accessing a role-specific route they don't have access to
  for (const [role, routes] of Object.entries(roleRoutes)) {
    for (const route of routes) {
      if (pathname.startsWith(route) && userRole !== role) {
        // User is trying to access a route they don't have permission for
        return getRoleDashboardRoute(userRole)
      }
    }
  }

  // If accessing generic /dashboard, redirect to role-specific dashboard
  if (pathname === "/dashboard") {
    return getRoleDashboardRoute(userRole)
  }

  return null // No redirect needed
}

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl

  // Allow public routes to pass through without any authentication checks
  if (isPublicRoute(req)) {
    // Public route access
    return NextResponse.next()
  }

  // Allow API routes to handle their own authentication
  if (isApiRoute(req) && !isPublicRoute(req)) {
    // API route access
    return NextResponse.next()
  }

  // Get authentication state
  const { userId, sessionId } = await auth()

  // Special handling for dashboard routes
  if (isDashboardRoute(req)) {
    if (!userId || !sessionId) {
      // Unauthenticated dashboard access, redirecting
      const signInUrl = new URL("/auth/sign-in", req.url)
      signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname)
      return NextResponse.redirect(signInUrl)
    }

    // Check onboarding status for authenticated users
    let user = null
    try {
      // Querying database for user
      if (!db || !users) {
        // Database not available, allowing access
        return NextResponse.next()
      }

      const userResult = await db
        .select({
          id: users.id,
          role: users.role,
          schoolId: users.schoolId,
          onboardingCompleted: users.onboardingCompleted,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)

      user = userResult[0] || null
      // Database query completed
    } catch (_error) {
      // Database error occurred
      // On database error, allow access but log the issue
      // Database unavailable, allowing access
      return NextResponse.next()
    }

    if (!user) {
      // User not found in database, redirecting for creation
      const userTypeUrl = new URL("/onboarding/user-type", req.url)
      return NextResponse.redirect(userTypeUrl)
    }

    // If onboarding is not completed, redirect to appropriate onboarding step
    if (!user.onboardingCompleted) {
      let redirectPath = "/onboarding/user-type"
      let shouldCompleteOnboarding = false

      // If user has a role, check if they meet completion requirements
      if (user.role) {
        switch (user.role) {
          case "SUPER_ADMIN":
            // Super admin only needs role to complete onboarding
            shouldCompleteOnboarding = true
            break
          case "SCHOOL_ADMIN":
          case "CLINICAL_PRECEPTOR":
          case "CLINICAL_SUPERVISOR":
            if (user.schoolId) {
              // Has role and schoolId, can complete onboarding
              shouldCompleteOnboarding = true
            } else {
              redirectPath = "/onboarding/user-type"
            }
            break
          case "STUDENT":
            if (user.schoolId) {
              // Student with schoolId can complete onboarding (programId is optional)
              shouldCompleteOnboarding = true
            } else {
              redirectPath = "/onboarding/user-type"
            }
            break
          default:
            redirectPath = "/onboarding/user-type"
        }
      }

      // If user doesn't meet completion requirements, redirect to onboarding
      if (!shouldCompleteOnboarding) {
        // Onboarding incomplete, redirecting
        const onboardingUrl = new URL(redirectPath, req.url)
        return NextResponse.redirect(onboardingUrl)
      }

      // If user meets completion requirements but onboarding is not marked complete,
      // redirect to complete onboarding page to let it handle the completion
      const completeOnboardingUrl = new URL("/onboarding/complete", req.url)
      return NextResponse.redirect(completeOnboardingUrl)
    }

    // Check role-based access control for dashboard routes
    const roleBasedRedirect = checkRoleBasedAccess(user.role, pathname)
    if (roleBasedRedirect) {
      // Role-based redirect required
      return NextResponse.redirect(new URL(roleBasedRedirect, req.url))
    }

    // Authenticated dashboard access granted
    return NextResponse.next()
  }

  // For all other protected routes
  if (!userId) {
    // Unauthenticated access to protected route
    const signInUrl = new URL("/auth/sign-in", req.url)
    signInUrl.searchParams.set("redirect_url", req.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Authenticated user access
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and development files
    "/((?!_next|@vite|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
}
