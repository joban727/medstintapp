import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

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
  "/terms",
  "/privacy",
])

// Define dashboard routes that require authentication
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"])

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes to pass through without any authentication checks
  if (isPublicRoute(req)) {
    // Public route accessed
    return NextResponse.next()
  }

  // Get authentication state
  const { userId, sessionId } = await auth()

  // Special handling for dashboard routes
  if (isDashboardRoute(req)) {
    if (!userId || !sessionId) {
      // Unauthenticated dashboard access, redirecting
      const signInUrl = new URL("/auth/sign-in", req.url)
      signInUrl.searchParams.set("redirect_url", req.url)
      return NextResponse.redirect(signInUrl)
    }

    // Authenticated dashboard access
    return NextResponse.next()
  }

  // For all other protected routes
  if (!userId) {
    // Unauthenticated access to protected route
    const signInUrl = new URL("/auth/sign-in", req.url)
    signInUrl.searchParams.set("redirect_url", req.url)
    return NextResponse.redirect(signInUrl)
  }

  // Authenticated user accessing route
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
