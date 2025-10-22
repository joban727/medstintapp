/**
 * Simplified Authentication Middleware
 * 
 * Streamlined authentication system that leverages existing Clerk sessions
 * while removing redundant RBAC complexity and security vulnerabilities.
 * 
 * Key improvements:
 * - Single source of truth (Clerk sessions)
 * - Removed user ID logging security vulnerability
 * - Simplified role-based access control
 * - Enhanced performance with caching
 * - Comprehensive error handling
 */

import { type NextRequest, NextResponse } from "next/server"
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { db } from "../database/db"
import { users } from "../database/schema"
import { logger } from "../lib/logger"
import { ClockError, ClockErrorType, createSystemError, AuditLogger, SecurityEventType } from "../lib/enhanced-error-handling"

// Route matchers
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/health',
  '/favicon.ico',
  '/_next(.*)',
  '/static(.*)'
])

const isOnboardingRoute = createRouteMatcher(['/onboarding(.*)'])
const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isApiRoute = createRouteMatcher(['/api(.*)'])

// User data interface (simplified)
interface UserData {
  id: string
  email: string | null
  name: string | null
  role: string | null
  schoolId: string | null
  onboardingCompleted: boolean | null
  isActive: boolean | null
}

// In-memory cache for user data (5-minute TTL)
const userCache = new Map<string, { data: UserData; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get cached user data or fetch from database
 */
async function getCachedUserData(userId: string): Promise<UserData | null> {
  // Check cache first
  const cached = userCache.get(userId)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  try {
    // Fetch from database
    const [userData] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        schoolId: users.schoolId,
        onboardingCompleted: users.onboardingCompleted,
        isActive: users.isActive,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!userData) {
      return null
    }

    // Cache the result
    userCache.set(userId, {
      data: userData,
      expires: Date.now() + CACHE_TTL
    })

    return userData
  } catch (error) {
    logger.error('Failed to fetch user data', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw createSystemError('Failed to fetch user data', true)
  }
}

/**
 * Clear user cache (useful for testing or when user data changes)
 */
export function clearUserCache(userId?: string): void {
  if (userId) {
    userCache.delete(userId)
  } else {
    userCache.clear()
  }
}

/**
 * Check if user has required role for admin routes
 */
function hasAdminAccess(role: string | null): boolean {
  return ['admin', 'super_admin', 'SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(role || '')
}

/**
 * Apply basic security headers
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
  
  return response
}

/**
 * Simplified authentication middleware
 */
export default clerkMiddleware(async (auth, request) => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substring(2)
  const pathname = request.nextUrl.pathname
  const method = request.method

  try {
    // Skip authentication for public routes
    if (isPublicRoute(request)) {
      const response = NextResponse.next()
      return applySecurityHeaders(response)
    }

    // Get authentication state from Clerk
    const { userId } = await auth()
    
    if (!userId) {
      logger.info('Unauthenticated access attempt', { pathname, method })
      
      const signInUrl = new URL('/sign-in', request.url)
      signInUrl.searchParams.set('redirect_url', pathname)
      return NextResponse.redirect(signInUrl)
    }

    // Get user data (with caching)
    const user = await getCachedUserData(userId)
    
    if (!user) {
      logger.warn('User not found in database', { requestId })
      AuditLogger.log(SecurityEventType.SUSPICIOUS_ACTIVITY, {
        type: 'user_not_found',
        pathname,
        method
      })
      
      return NextResponse.redirect(new URL('/sign-up', request.url))
    }

    // Check if user account is active
    if (user.isActive === false) {
      logger.warn('Inactive user access attempt', { requestId })
      AuditLogger.log(SecurityEventType.ACCOUNT_LOCKED, {
        type: 'inactive_account',
        pathname
      })
      
      return NextResponse.redirect(new URL('/account-inactive', request.url))
    }

    // Admin route protection
    if (isAdminRoute(request) && !hasAdminAccess(user.role)) {
      logger.warn('Unauthorized admin access attempt', {
        requestId,
        role: user.role,
        pathname
      })
      
      AuditLogger.log(SecurityEventType.INSUFFICIENT_PERMISSIONS, {
        type: 'admin_access_denied',
        role: user.role,
        pathname
      })
      
      // For API routes, return JSON error
      if (isApiRoute(request)) {
        return NextResponse.json(
          { error: 'Insufficient permissions', code: 'ADMIN_ACCESS_REQUIRED' },
          { status: 403 }
        )
      }
      
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Onboarding flow logic
    if (!user.onboardingCompleted) {
      if (!isOnboardingRoute(request)) {
        logger.info('Redirecting to onboarding', { requestId })
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    } else {
      // Redirect completed users away from onboarding
      if (isOnboardingRoute(request)) {
        const dashboardUrl = hasAdminAccess(user.role) ? '/admin/dashboard' : '/dashboard'
        return NextResponse.redirect(new URL(dashboardUrl, request.url))
      }
    }

    // Create successful response
    const response = NextResponse.next()
    const secureResponse = applySecurityHeaders(response)
    
    // Add user context headers for downstream processing (without sensitive data)
    secureResponse.headers.set('x-user-role', user.role || 'unknown')
    secureResponse.headers.set('x-request-id', requestId)
    secureResponse.headers.set('x-onboarding-completed', user.onboardingCompleted ? 'true' : 'false')

    const processingTime = Date.now() - startTime
    
    logger.info('Authentication successful', {
      requestId,
      pathname,
      method,
      processingTime,
      role: user.role,
      onboardingCompleted: user.onboardingCompleted
    })

    return secureResponse

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('Authentication middleware error', {
      requestId,
      pathname,
      method,
      processingTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    AuditLogger.log(SecurityEventType.SUSPICIOUS_ACTIVITY, {
      type: 'middleware_error',
      pathname,
      method,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    // For API routes, return JSON error
    if (isApiRoute(request)) {
      return NextResponse.json(
        {
          error: 'Authentication failed',
          code: 'AUTH_ERROR',
          requestId
        },
        { status: 500 }
      )
    }

    // For regular routes, redirect to sign-in
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }
})

// Middleware configuration
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/webhooks (webhook endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api/webhooks|_next/static|_next/image|favicon.ico|public/).*)',
  ],
}

/**
 * Utility functions for testing and monitoring
 */
export {
  getCachedUserData,
  clearUserCache,
  hasAdminAccess,
  applySecurityHeaders
}

/**
 * Health check function
 */
export const getMiddlewareHealth = () => {
  return {
    timestamp: new Date().toISOString(),
    cacheSize: userCache.size,
    status: 'healthy'
  }
}