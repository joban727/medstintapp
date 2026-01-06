import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { db } from "../../../../database/connection-pool"
import { subscriptions } from "../../../../database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"
import { withCSRF } from "@/lib/csrf-middleware"

// POST /api/billing/cancel-subscription - Cancel user's subscription (CSRF protected)
export const POST = withCSRF(async (_request: NextRequest) => {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get user's active subscription
    const subscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.referenceId, userId as string))
      .limit(1)

    if (!subscription.length) {
      return NextResponse.json({ error: "No active subscription found" }, { status: 404 })
    }

    const currentSubscription = subscription[0]

    if (currentSubscription.status !== "active") {
      return NextResponse.json({ error: "Subscription is not active" }, { status: 400 })
    }

    // NOTE: Database update for cancel-at-period-end is implemented
    // Stripe API integration can be added here when needed for immediate cancellation
    await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
      })
      .where(eq(subscriptions.id, currentSubscription.id))

    return NextResponse.json({
      success: true,
      message: "Subscription will be cancelled at the end of the current billing period",
      subscription: {
        ...currentSubscription,
        cancelAtPeriodEnd: true,
      },
    })
  } catch (error) {
    console.error("Error cancelling subscription:", error)

    // Invalidate related caches
    try {
      await cacheIntegrationService.clear()
    } catch (cacheError) {
      console.warn("Cache invalidation error in billing/cancel-subscription/route.ts:", cacheError)
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
})
