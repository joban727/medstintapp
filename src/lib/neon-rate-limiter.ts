/**
 * Neon-Based Rate Limiter
 * Uses PostgreSQL for distributed rate limiting
 * Optimized for Clerk-authenticated apps with RBAC
 */

import { and, eq, gt, sql } from "drizzle-orm"
import type { NextRequest } from "next/server"
import { db } from "@/database/connection-pool"
import { rateLimits } from "@/database/schema"

interface RateLimitConfig {
    windowMs: number // Time window in milliseconds
    maxRequests: number // Maximum requests per window
    endpoint: string // Endpoint identifier for grouping
}

interface RateLimitResult {
    allowed: boolean
    remaining: number
    resetTime: Date
    retryAfterMs?: number
}

/**
 * Neon Rate Limiter Class
 * Uses UPSERT for atomic increment operations
 */
export class NeonRateLimiter {
    private config: RateLimitConfig

    constructor(config: RateLimitConfig) {
        this.config = config
    }

    /**
     * Check rate limit for a request
     * @param key - User ID or IP address to rate limit
     */
    async checkLimit(key: string): Promise<RateLimitResult> {
        const now = new Date()
        const windowEnd = new Date(now.getTime() + this.config.windowMs)

        try {
            // Check for existing valid window
            const [existing] = await db
                .select()
                .from(rateLimits)
                .where(
                    and(
                        eq(rateLimits.key, key),
                        eq(rateLimits.endpoint, this.config.endpoint),
                        gt(rateLimits.windowEnd, now)
                    )
                )
                .limit(1)

            if (existing) {
                // Window exists, check if limit exceeded
                if (existing.count >= this.config.maxRequests) {
                    return {
                        allowed: false,
                        remaining: 0,
                        resetTime: existing.windowEnd,
                        retryAfterMs: existing.windowEnd.getTime() - now.getTime(),
                    }
                }

                // Increment counter
                await db
                    .update(rateLimits)
                    .set({
                        count: existing.count + 1,
                        updatedAt: now,
                    })
                    .where(eq(rateLimits.id, existing.id))

                return {
                    allowed: true,
                    remaining: this.config.maxRequests - existing.count - 1,
                    resetTime: existing.windowEnd,
                }
            }

            // No valid window, create new one
            await db
                .insert(rateLimits)
                .values({
                    key,
                    endpoint: this.config.endpoint,
                    count: 1,
                    windowStart: now,
                    windowEnd,
                })
                .onConflictDoUpdate({
                    target: [rateLimits.key, rateLimits.endpoint],
                    set: {
                        count: sql`${rateLimits.count} + 1`,
                        windowStart: now,
                        windowEnd,
                        updatedAt: now,
                    },
                })

            return {
                allowed: true,
                remaining: this.config.maxRequests - 1,
                resetTime: windowEnd,
            }
        } catch (error) {
            console.error("Rate limit check failed:", error)
            // On error, allow request but log it
            return {
                allowed: true,
                remaining: this.config.maxRequests - 1,
                resetTime: windowEnd,
            }
        }
    }

    /**
     * Check limit using request object (extracts user ID or IP)
     */
    async checkLimitFromRequest(
        request: NextRequest,
        userId?: string
    ): Promise<RateLimitResult> {
        // Prefer user ID (authenticated), fallback to IP
        const key = userId || this.getIpFromRequest(request)
        return this.checkLimit(key)
    }

    private getIpFromRequest(request: NextRequest): string {
        return (
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request.headers.get("x-real-ip") ||
            "unknown"
        )
    }
}

// Pre-configured rate limiters for different operations
export const clockOperationLimiter = new NeonRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // Max 10 clock operations per minute
    endpoint: "clock",
})

export const invitationLimiter = new NeonRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // Max 20 invitation operations per minute
    endpoint: "invitations",
})

export const adminApiLimiter = new NeonRateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 50, // Max 50 admin requests per 5 minutes
    endpoint: "admin",
})

export const generalApiLimiter = new NeonRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 200, // Max 200 requests per 15 minutes
    endpoint: "general",
})

/**
 * Utility function to apply rate limiting in API routes
 * 
 * @example
 * const rateCheck = await applyRateLimit(request, userId, clockOperationLimiter)
 * if (!rateCheck.success) return rateCheck.response
 */
export async function applyRateLimit(
    request: NextRequest,
    userId: string | undefined,
    limiter: NeonRateLimiter
): Promise<{ success: true } | { success: false; response: Response }> {
    const result = await limiter.checkLimitFromRequest(request, userId)

    if (!result.allowed) {
        return {
            success: false,
            response: new Response(
                JSON.stringify({
                    error: "Too many requests. Please try again later.",
                    retryAfterMs: result.retryAfterMs,
                }),
                {
                    status: 429,
                    headers: {
                        "Content-Type": "application/json",
                        "Retry-After": Math.ceil((result.retryAfterMs || 60000) / 1000).toString(),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": result.resetTime.toISOString(),
                    },
                }
            ),
        }
    }

    return { success: true }
}

/**
 * Cleanup expired rate limit entries
 * Call this periodically (e.g., via cron job or scheduled function)
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
    try {
        const result = await db
            .delete(rateLimits)
            .where(sql`${rateLimits.windowEnd} < NOW()`)

        return result.rowCount || 0
    } catch (error) {
        console.error("Failed to cleanup rate limits:", error)
        return 0
    }
}
