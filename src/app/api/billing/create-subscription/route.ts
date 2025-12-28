import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { z } from "zod"
import { db } from "../../../../database/connection-pool"
import { subscriptions, users } from "../../../../database/schema"
import { cacheIntegrationService } from "@/lib/cache-integration"

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

    // Initialize Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-08-27.basil", // Use latest API version
    })

    let stripeCustomerId = user[0].stripeCustomerId

    // Create Stripe customer if not exists
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user[0].email,
        name: user[0].name || undefined,
        metadata: {
          userId: user[0].id,
        },
      })
      stripeCustomerId = customer.id

      // Update user with Stripe Customer ID
      await db
        .update(users)
        .set({ stripeCustomerId })
        .where(eq(users.id, userId as string))
    }

    // Create subscription in Stripe
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: body.priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent"],
      metadata: {
        userId: user[0].id,
        planId: body.planId,
      },
    })

    // Create subscription record in database
    const newSubscription = {
      id: crypto.randomUUID(),
      plan: body.planId,
      referenceId: user[0].id,
      stripeCustomerId: stripeCustomerId,
      stripeSubscriptionId: subscription.id,
      status: subscription.status.toUpperCase(),
      periodStart: new Date((subscription as any).current_period_start * 1000),
      periodEnd: new Date((subscription as any).current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      seats: 1,
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    }

    await db.insert(subscriptions).values([newSubscription])

    return NextResponse.json({
      success: true,
      subscription: newSubscription,
      clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
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
      await cacheIntegrationService.clear()
    } catch (cacheError) {
      console.warn("Cache invalidation error in billing/create-subscription/route.ts:", cacheError)
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

