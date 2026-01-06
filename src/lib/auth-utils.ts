/**
 * Production-Ready Authentication Middleware
 *
 * Single source of truth for authentication and onboarding flow.
 * This middleware handles:
 * - Clerk authentication
 * - User data caching (5-minute TTL)
 * - Onboarding status checking and redirects
 * - Role-based dashboard routing
 * - Security headers
 * - Comprehensive error handling
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { db } from "@/database/connection-pool"
import { users } from "@/database/schema"
import type { UserRole } from "@/types"

// =============================================================================
// Route Configuration
// =============================================================================

/** Public routes - no authentication required */
export const isPublicRoute = createRouteMatcher([
  "/",
  "/auth(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/public(.*)",
  "/api/health(.*)",
  "/api/test(.*)",
  "/terms",
  "/privacy",
  "/showcase",
  "/account-inactive",
  "/invite(.*)",
  "/approval-pending",
  "/subscribe(.*)",
  "/subscription-required",
])

/** Onboarding routes - require auth but allow incomplete onboarding */
export const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"])

/** Dashboard routes - require complete onboarding */
export const isDashboardRoute = createRouteMatcher(["/dashboard(.*)"])

/** API routes - handle their own auth via route handlers */
export const isApiRoute = createRouteMatcher(["/api/(.*)"])

// =============================================================================
// User Caching System
// =============================================================================

interface CachedUser {
  id: string
  email: string | null
  name: string | null
  role: UserRole | null
  schoolId: string | null
  onboardingCompleted: boolean | null
  isActive: boolean | null
  approvalStatus: string | null
  subscriptionStatus: string | null
}

interface CacheEntry {
  data: CachedUser
  expiresAt: number
}

/** Result type for getCachedUser to distinguish between "not found" and "error" */
type UserFetchResult =
  | { status: "found"; user: CachedUser }
  | { status: "not_found" }
  | { status: "error"; error: Error }

/** In-memory cache for user data */
const userCache = new Map<string, CacheEntry>()

/** Cache TTL: 5 minutes */
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get user data with caching for performance
 * Returns result object to distinguish between "user not found" and "database error"
 * @param userId - The user's ID
 * @param bypassCache - If true, skip cache and fetch fresh from database
 */
export async function getCachedUser(
  userId: string,
  bypassCache: boolean = false
): Promise<UserFetchResult> {
  const now = Date.now()

  // Skip cache lookup if bypass is requested (e.g., after account reset)
  if (!bypassCache) {
    const cached = userCache.get(userId)

    // Return cached data if still valid
    if (cached && cached.expiresAt > now) {
      return { status: "found", user: cached.data }
    }
  } else {
    // Clear any existing cached data for this user
    userCache.delete(userId)
  }

  try {
    const [userData] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        schoolId: users.schoolId,
        onboardingCompleted: users.onboardingCompleted,
        isActive: users.isActive,
        approvalStatus: users.approvalStatus,
        subscriptionStatus: users.subscriptionStatus,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!userData) {
      // User genuinely not in database yet (new Clerk user)
      return { status: "not_found" }
    }

    // Cache the result
    const cachedUser: CachedUser = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role as UserRole | null,
      schoolId: userData.schoolId,
      onboardingCompleted: userData.onboardingCompleted,
      isActive: userData.isActive,
      approvalStatus: userData.approvalStatus,
      subscriptionStatus: userData.subscriptionStatus,
    }

    userCache.set(userId, {
      data: cachedUser,
      expiresAt: now + CACHE_TTL_MS,
    })

    return { status: "found", user: cachedUser }
  } catch (error) {
    console.error("[Middleware] Database error fetching user:", error)
    return { status: "error", error: error instanceof Error ? error : new Error(String(error)) }
  }
}

/**
 * Invalidate user cache (call when user data changes)
 * IMPORTANT: Call this after updating user data (e.g., after onboarding completion)
 */
export function invalidateUserCache(userId: string): void {
  userCache.delete(userId)
}

/**
 * Clear entire user cache (useful for testing or deployments)
 */
export function clearUserCache(): void {
  userCache.clear()
}

// =============================================================================
// Security Headers
// =============================================================================

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  // DNS prefetch control
  response.headers.set("X-DNS-Prefetch-Control", "on")

  // HTTPS enforcement
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "SAMEORIGIN")

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")

  // Control referrer information
  response.headers.set("Referrer-Policy", "origin-when-cross-origin")

  // XSS protection (legacy, but still useful for older browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block")

  return response
}

/**
 * Create response with cache-busting headers for auth-sensitive pages
 * @param clearCacheBypassCookie - If true, delete the cache_bypass_user cookie
 */
export function createFreshResponse(clearCacheBypassCookie: boolean = false): NextResponse {
  const response = NextResponse.next()
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  response.headers.set("Pragma", "no-cache")
  response.headers.set("Expires", "0")
  response.headers.set("x-middleware-cache", "no-cache")

  // Clear the cache bypass cookie if requested
  if (clearCacheBypassCookie) {
    response.cookies.delete("cache_bypass_user")
  }

  return applySecurityHeaders(response)
}

// =============================================================================
// Dashboard URL Helper
// =============================================================================

/**
 * Get the appropriate dashboard URL based on user role
 */
export function getRoleDashboardUrl(role: UserRole | null): string {
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
