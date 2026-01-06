/**
 * CSRF Middleware
 * Provides CSRF protection for state-changing API routes
 */

import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

// CSRF token validation
const CSRF_HEADER = "x-csrf-token"
const CSRF_COOKIE = "__csrf"

/**
 * Validate CSRF token from request
 * Compares header token with cookie token
 */
function validateCSRFToken(request: NextRequest): boolean {
  const headerToken = request.headers.get(CSRF_HEADER)
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value

  // If no tokens, validation fails
  if (!headerToken || !cookieToken) {
    return false
  }

  // Tokens must match
  return headerToken === cookieToken
}

/**
 * Check if request method requires CSRF protection
 */
function requiresCSRFProtection(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())
}

/**
 * CSRF validation middleware wrapper
 * Use this to wrap API route handlers that need CSRF protection
 *
 * @example
 * export const POST = withCSRF(async (request) => {
 *   // Your handler logic
 *   return Response.json({ success: true })
 * })
 */
export function withCSRF<T extends unknown[]>(
  handler: (request: NextRequest, ...args: T) => Promise<Response>
): (request: NextRequest, ...args: T) => Promise<Response> {
  return async (request: NextRequest, ...args: T) => {
    // Only validate CSRF for state-changing methods
    if (requiresCSRFProtection(request.method)) {
      // Skip CSRF for webhook endpoints (they use signature verification)
      const pathname = new URL(request.url).pathname
      if (pathname.startsWith("/api/webhooks/")) {
        return handler(request, ...args)
      }

      const isValid = validateCSRFToken(request)
      if (!isValid) {
        return NextResponse.json({ error: "Invalid or missing CSRF token" }, { status: 403 })
      }
    }

    return handler(request, ...args)
  }
}

/**
 * Generate a new CSRF token
 * Call this on authenticated endpoints to provide tokens to the client
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/**
 * Create a response with CSRF token set in cookie
 * Use this for endpoints that need to provide CSRF tokens to clients
 */
export function setCSRFCookie(response: NextResponse, token?: string): NextResponse {
  const csrfToken = token || generateCSRFToken()

  response.cookies.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false, // Needs to be readable by JS to send in header
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  })

  // Also set in header for immediate access
  response.headers.set(CSRF_HEADER, csrfToken)

  return response
}

/**
 * Middleware to add CSRF token to responses
 * Can be used in Next.js middleware for automatic token distribution
 */
export function addCSRFToResponse(response: NextResponse): NextResponse {
  // Check if CSRF cookie already exists
  const existingToken = response.cookies.get(CSRF_COOKIE)?.value

  if (!existingToken) {
    return setCSRFCookie(response)
  }

  return response
}
