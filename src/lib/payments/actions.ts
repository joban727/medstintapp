"use server"

import { eq, and, sql } from "drizzle-orm"
import { getCurrentUser } from "@/lib/auth-clerk"
import { db } from "@/database/connection-pool"
import { subscriptions, schools, seatAssignments, users } from "@/database/schema"
import { stripe } from "@/lib/payments/stripe"
import { getSchoolSeatPlans } from "./plans-service"

interface Subscription {
  id: string
  status: string
  plan?: string
  cancelAtPeriodEnd?: boolean
  periodEnd?: Date
  stripeSubscriptionId?: string
  seats?: number
  limits?: {
    tokens?: number
  }
  [key: string]: unknown
}

export async function getActiveSubscription(): Promise<{
  status: boolean
  message?: string
  subscription: Subscription | null
}> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      status: false,
      message: "You need to be logged in.",
      subscription: null,
    }
  }

  // Fetch subscription from database
  const userSubscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.referenceId, user.id))
    .limit(1)

  if (!userSubscription.length) {
    // Check for school-paid seat
    const seatAssignment = await db
      .select()
      .from(seatAssignments)
      .where(and(eq(seatAssignments.studentId, user.id), eq(seatAssignments.status, "ACTIVE")))
      .limit(1)

    if (seatAssignment.length) {
      return {
        subscription: {
          id: seatAssignment[0].id,
          status: "active",
          plan: "school_paid",
          seats: 1,
        },
        status: true,
      }
    }

    return {
      subscription: null,
      status: true,
    }
  }

  const sub = userSubscription[0]

  return {
    subscription: {
      id: sub.id,
      status: sub.status ?? "inactive",
      plan: sub.plan ?? undefined,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? undefined,
      periodEnd: sub.periodEnd ?? undefined,
      stripeSubscriptionId: sub.stripeSubscriptionId ?? undefined,
      seats: sub.seats ?? undefined,
      limits: {
        tokens: 1000, // Default limit, can be customized based on plan
      },
    },
    status: true,
  }
}

export async function updateExistingSubscription(
  subId: string,
  switchToPriceId: string
): Promise<{ status: boolean; message: string }> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      status: false,
      message: "You need to be logged in.",
    }
  }

  if (!subId || !switchToPriceId) {
    return {
      status: false,
      message: "Invalid parameters.",
    }
  }

  if (!stripe) {
    return {
      status: false,
      message: "Stripe is not configured.",
    }
  }

  try {
    const subscription = await stripe.subscriptions.retrieve(subId)
    if (!subscription.items.data.length) {
      return {
        status: false,
        message: "Invalid subscription. No subscription items found!",
      }
    }

    await stripe.subscriptions.update(subId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: switchToPriceId,
        },
      ],
      cancel_at_period_end: false,
      proration_behavior: "create_prorations",
    })

    return {
      status: true,
      message: "Subscription updated successfully!",
    }
  } catch (_error) {
    // Handle payment error silently
    return {
      status: false,
      message: "Something went wrong while updating the subcription.",
    }
  }
}

export async function createSubscription(
  priceId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ status: boolean; url?: string; message?: string }> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      status: false,
      message: "You need to be logged in.",
    }
  }

  if (!stripe) {
    return {
      status: false,
      message: "Stripe is not configured.",
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: user.email,
      metadata: {
        userId: user.id,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return {
      status: true,
      url: session.url || undefined,
    }
  } catch (error) {
    console.error("Error creating checkout session:", error)
    return {
      status: false,
      message: "Failed to create checkout session.",
    }
  }
}

export async function cancelSubscription(): Promise<{
  status: boolean
  message: string
}> {
  const user = await getCurrentUser()
  if (!user) {
    return {
      status: false,
      message: "You need to be logged in.",
    }
  }

  if (!stripe) {
    return {
      status: false,
      message: "Stripe is not configured.",
    }
  }

  try {
    const userSubscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.referenceId, user.id))
      .limit(1)

    if (!userSubscription.length || !userSubscription[0].stripeSubscriptionId) {
      return {
        status: false,
        message: "No active subscription found.",
      }
    }

    await stripe.subscriptions.update(userSubscription[0].stripeSubscriptionId, {
      cancel_at_period_end: true,
    })

    return {
      status: true,
      message: "Subscription canceled successfully.",
    }
  } catch (error) {
    console.error("Error canceling subscription:", error)
    return {
      status: false,
      message: "Failed to cancel subscription.",
    }
  }
}

export async function purchaseSeats(
  schoolId: string,
  quantity: number,
  interval: "month" | "year",
  successUrl: string,
  cancelUrl: string
): Promise<{ status: boolean; url?: string; message?: string }> {
  const user = await getCurrentUser()
  if (!user || (user.role !== "SCHOOL_ADMIN" && user.role !== "SUPER_ADMIN")) {
    return { status: false, message: "Unauthorized" }
  }

  if (!stripe) {
    return { status: false, message: "Stripe is not configured" }
  }

  // Define price IDs (should be in env or DB, hardcoded for now based on plan)
  const seatPlans = await getSchoolSeatPlans()
  const selectedPlan = seatPlans.find((p) => p.interval === interval)

  if (!selectedPlan) {
    return { status: false, message: "Seat pricing not configured" }
  }

  const priceId = selectedPlan.stripePriceId

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: quantity,
        },
      ],
      customer_email: user.email,
      metadata: {
        schoolId: schoolId,
        type: "SEAT_PURCHASE",
        quantity: quantity.toString(),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return { status: true, url: session.url || undefined }
  } catch (error) {
    console.error("Error creating seat purchase session:", error)
    return { status: false, message: "Failed to create checkout session" }
  }
}

export async function assignSeat(
  studentId: string,
  schoolId: string
): Promise<{ status: boolean; message: string }> {
  const user = await getCurrentUser()
  // Allow system/admin/self(during onboarding) to assign
  if (!user) return { status: false, message: "Unauthorized" }

  try {
    return await db.transaction(async (tx) => {
      // Check school limits
      const [school] = await tx.select().from(schools).where(eq(schools.id, schoolId)).limit(1)

      if (!school || school.billingModel !== "SCHOOL_PAYS") {
        return { status: false, message: "School does not support seat assignment" }
      }

      if (school.seatsUsed >= school.seatsLimit) {
        return { status: false, message: "School seat limit reached" }
      }

      // Check if student already has a seat
      const existing = await tx
        .select()
        .from(seatAssignments)
        .where(and(eq(seatAssignments.studentId, studentId), eq(seatAssignments.status, "ACTIVE")))
        .limit(1)

      if (existing.length) {
        return { status: true, message: "Seat already assigned" }
      }

      // Assign seat
      await tx.insert(seatAssignments).values({
        schoolId,
        studentId,
        status: "ACTIVE",
      })

      // Increment usage
      await tx
        .update(schools)
        .set({ seatsUsed: sql`${schools.seatsUsed} + 1` })
        .where(eq(schools.id, schoolId))

      // Update user subscription status
      await tx.update(users).set({ subscriptionStatus: "ACTIVE" }).where(eq(users.id, studentId))

      return { status: true, message: "Seat assigned successfully" }
    })
  } catch (error) {
    console.error("Error assigning seat:", error)
    return { status: false, message: "Failed to assign seat" }
  }
}

export async function revokeSeat(
  studentId: string,
  schoolId: string
): Promise<{ status: boolean; message: string }> {
  const user = await getCurrentUser()
  if (!user || (user.role !== "SCHOOL_ADMIN" && user.role !== "SUPER_ADMIN")) {
    return { status: false, message: "Unauthorized" }
  }

  try {
    return await db.transaction(async (tx) => {
      const [assignment] = await tx
        .select()
        .from(seatAssignments)
        .where(
          and(
            eq(seatAssignments.studentId, studentId),
            eq(seatAssignments.schoolId, schoolId),
            eq(seatAssignments.status, "ACTIVE")
          )
        )
        .limit(1)

      if (!assignment) {
        return { status: false, message: "No active seat assignment found" }
      }

      // Revoke seat
      await tx
        .update(seatAssignments)
        .set({ status: "REVOKED", revokedAt: new Date() })
        .where(eq(seatAssignments.id, assignment.id))

      // Decrement usage
      await tx
        .update(schools)
        .set({ seatsUsed: sql`${schools.seatsUsed} - 1` })
        .where(eq(schools.id, schoolId))

      // Update user subscription status
      await tx.update(users).set({ subscriptionStatus: "NONE" }).where(eq(users.id, studentId))

      return { status: true, message: "Seat revoked successfully" }
    })
  } catch (error) {
    console.error("Error revoking seat:", error)
    return { status: false, message: "Failed to revoke seat" }
  }
}

export async function handleCheckoutCompleted(session: any) {
  if (session?.metadata?.type === "SEAT_PURCHASE") {
    const schoolId = session.metadata.schoolId
    const quantity = parseInt(session.metadata.quantity || "0")

    if (schoolId && quantity > 0) {
      try {
        await db
          .update(schools)
          .set({
            seatsLimit: sql`${schools.seatsLimit} + ${quantity}`,
            billingModel: "SCHOOL_PAYS",
          })
          .where(eq(schools.id, schoolId))
      } catch (error) {
        console.error("Error updating school seats:", error)
      }
    }
    return
  }

  if (!session?.metadata?.userId) {
    console.error("Missing userId in checkout session metadata")
    return
  }

  const userId = session.metadata.userId
  const subscriptionId = session.subscription as string

  try {
    const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as any

    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      referenceId: userId,
      stripeSubscriptionId: subscriptionId,
      status: subscription.status,
      plan: subscription.items.data[0].price.id,
      periodStart: new Date(subscription.current_period_start * 1000),
      periodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    })
  } catch (error) {
    console.error("Error handling checkout completed:", error)
  }
}

export async function handleInvoicePaid(invoice: any) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  try {
    const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as any

    await db
      .update(subscriptions)
      .set({
        status: subscription.status,
        periodStart: new Date(subscription.current_period_start * 1000),
        periodEnd: new Date(subscription.current_period_end * 1000),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
  } catch (error) {
    console.error("Error handling invoice paid:", error)
  }
}

export async function handlePaymentFailed(invoice: any) {
  const subscriptionId = invoice.subscription as string
  if (!subscriptionId) return

  try {
    await db
      .update(subscriptions)
      .set({
        status: "past_due",
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
  } catch (error) {
    console.error("Error handling payment failed:", error)
  }
}

export async function handleSubscriptionUpdated(subscription: any) {
  try {
    await db
      .update(subscriptions)
      .set({
        status: subscription.status,
        plan: subscription.items.data[0].price.id,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        periodStart: new Date(subscription.current_period_start * 1000),
        periodEnd: new Date(subscription.current_period_end * 1000),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
  } catch (error) {
    console.error("Error handling subscription updated:", error)
  }
}

export async function handleSubscriptionDeleted(subscription: any) {
  try {
    await db
      .update(subscriptions)
      .set({
        status: "canceled",
        cancelAtPeriodEnd: false,
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id))
  } catch (error) {
    console.error("Error handling subscription deleted:", error)
  }
}

export async function checkSchoolBillingStatus(schoolId: string): Promise<{
  supported: boolean
  seatsAvailable: boolean
  message?: string
}> {
  try {
    const [school] = await db.select().from(schools).where(eq(schools.id, schoolId)).limit(1)

    if (!school) return { supported: false, seatsAvailable: false, message: "School not found" }

    if (school.billingModel !== "SCHOOL_PAYS") {
      return { supported: false, seatsAvailable: false }
    }

    return {
      supported: true,
      seatsAvailable: school.seatsUsed < school.seatsLimit,
    }
  } catch (error) {
    console.error("Error checking school billing:", error)
    return { supported: false, seatsAvailable: false, message: "Error checking status" }
  }
}
