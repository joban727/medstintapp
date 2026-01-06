"use server"

import { auth } from "@clerk/nextjs/server"
import { eq } from "drizzle-orm"
import { NextResponse, type NextRequest } from "next/server"
import Stripe from "stripe"
import { db } from "../../../../database/connection-pool"
import { users } from "../../../../database/schema"
import { getStudentPlan } from "../../../../lib/payments/plans-service"
import { withCSRF } from "@/lib/csrf-middleware"

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

// POST /api/billing/create-student-checkout - Create Stripe Checkout (CSRF protected)
export const POST = withCSRF(async (request: NextRequest) => {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!stripe) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 500 })
    }

    // Get user from database
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify user is a student
    if (user.role !== "STUDENT") {
      return NextResponse.json(
        { error: "Only students can subscribe to the student plan" },
        { status: 403 }
      )
    }

    // Check if user already has an active subscription
    if (
      user.subscriptionStatus &&
      ["ACTIVE", "TRIAL", "GRANDFATHERED"].includes(user.subscriptionStatus)
    ) {
      return NextResponse.json(
        { error: "You already have an active subscription" },
        { status: 400 }
      )
    }

    // Parse request body for success/cancel URLs
    let successUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/subscribe/success`
    let cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/subscribe`

    try {
      const body = await request.json()
      if (body.successUrl) successUrl = body.successUrl
      if (body.cancelUrl) cancelUrl = body.cancelUrl
    } catch {
      // Body is optional, use defaults
    }

    // Create or get Stripe customer
    let stripeCustomerId = user.stripeCustomerId

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name || undefined,
        metadata: {
          userId: user.id,
          role: "STUDENT",
        },
      })
      stripeCustomerId = customer.id

      // Update user with Stripe Customer ID
      await db.update(users).set({ stripeCustomerId }).where(eq(users.id, userId))
    }

    // Create Stripe Checkout Session
    const studentPlan = await getStudentPlan()
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: studentPlan.stripePriceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        planType: "student",
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          planType: "student",
        },
      },
      allow_promotion_codes: true,
    })

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
    })
  } catch (error) {
    console.error("Error creating student checkout session:", error)
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 })
  }
})
