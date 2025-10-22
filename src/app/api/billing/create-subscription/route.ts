import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import { subscriptions, users } from "../../../../database/schema"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Validation schema for subscription creation
const createSubscriptionSchema = z.object({
  planId: z.string(),
  priceId: z.string(),
  paymentMethodId: z.string().optional(),
})

// POST /api/billing/create-subscription - Create a new subscription
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    createSubscriptionSchema.parse(body)

    // Get user from database
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId as string))
      .limit(1)
    if (!user.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user already has an active subscription
    const existingSubscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.referenceId, user[0].id))
      .limit(1)

    if (existingSubscription.length > 0 && existingSubscription[0].status === "ACTIVE") {
      return NextResponse.json(
        { error: "User already has an active subscription" },
        { status: 400 }
      )
    }

    // TODO: Integrate with Stripe to create actual subscription
    // For now, create a mock subscription record
    const newSubscription = {
      id: crypto.randomUUID(),
      plan: "basic", // Default plan
      referenceId: user[0].id,
      stripeCustomerId: user[0].stripeCustomerId || null,
      stripeSubscriptionId: `sub_${crypto.randomUUID()}`,
      status: "active",
      periodStart: new Date(),
      periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      cancelAtPeriodEnd: false,
      seats: 1,
      trialStart: null,
      trialEnd: null,
    }

    await db.insert(subscriptions).values([newSubscription])

    return NextResponse.json({
      success: true,
      subscription: newSubscription,
      message: "Subscription created successfully",
    })
  } catch (error) {
    console.error("Error creating subscription:", error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      )
    }
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in billing/create-subscription/route.ts:', cacheError)
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
