import type { NextRequest } from "next/server"

// Ensure singletons across hot reloads and avoid duplicate intervals
declare global {
  // Global store for rate limiter entries

  var __rateLimitStore: Map<string, RateLimitEntry> | undefined
  // Global cleanup interval handle

  var __rateLimiterCleanupInterval: NodeJS.Timeout | undefined
  // Guard to attach shutdown hooks once

  var __rateLimiterShutdownHookSetup: boolean | undefined
}

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = (globalThis.__rateLimitStore ??= new Map<string, RateLimitEntry>())

function setupCleanupInterval(): void {
  if (globalThis.__rateLimiterCleanupInterval) return
  globalThis.__rateLimiterCleanupInterval = setInterval(
    () => {
      const now = Date.now()
      for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetTime < now) {
          rateLimitStore.delete(key)
        }
      }
    },
    5 * 60 * 1000
  )
}

function setupShutdownHooks(): void {
  if (globalThis.__rateLimiterShutdownHookSetup) return
  globalThis.__rateLimiterShutdownHookSetup = true
  const clear = () => {
    if (globalThis.__rateLimiterCleanupInterval) {
      clearInterval(globalThis.__rateLimiterCleanupInterval)
      globalThis.__rateLimiterCleanupInterval = undefined
    }
  }
  // Attach once; Node.js environment
  try {
    process.on("beforeExit", clear)
    process.on("SIGINT", clear)
    process.on("SIGTERM", clear)
  } catch (_) {
    // ignore if process is not available (edge runtimes)
  }
}

setupCleanupInterval()
setupShutdownHooks()

export class RateLimiter {
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  async checkLimit(request: NextRequest): Promise<{
    allowed: boolean
    remaining: number
    resetTime: number
  }> {
    const key = this.config.keyGenerator
      ? this.config.keyGenerator(request)
      : this.getDefaultKey(request)

    const now = Date.now()
    const windowStart = now
    const windowEnd = now + this.config.windowMs

    let entry = rateLimitStore.get(key)

    // If no entry exists or window has expired, create new entry
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 1,
        resetTime: windowEnd,
      }
      rateLimitStore.set(key, entry)

      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: windowEnd,
      }
    }

    // Check if limit exceeded
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      }
    }

    // Increment count
    entry.count++
    rateLimitStore.set(key, entry)

    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    }
  }

  private getDefaultKey(request: NextRequest): string {
    // Use IP address and user agent as default key
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"
    const userAgent = request.headers.get("user-agent") || "unknown"
    return `${ip}:${userAgent}`
  }
}

// Pre-configured rate limiters for different operations
export const clockOperationLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // Max 10 clock operations per minute
  keyGenerator: (request) => {
    // Use user ID from auth context if available, fallback to IP
    const userId = request.headers.get("x-user-id")
    if (userId) {
      return `clock:${userId}`
    }
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"
    return `clock:ip:${ip}`
  },
})

export const generalApiLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // Max 100 requests per 15 minutes
})

export const adminApiLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 30, // Max 30 requests per 5 minutes
  keyGenerator: (request) => {
    const userId = request.headers.get("x-user-id")
    if (userId) return `admin:${userId}`
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown"
    return `admin:ip:${ip}`
  },
})
