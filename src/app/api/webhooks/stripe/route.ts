import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { db } from "../../../../database/connection-pool"
import { subscriptions, users } from "../../../../database/schema"

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

// Type for subscription status
type SubscriptionStatus = "NONE" | "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "GRANDFATHERED"

// POST /api/webhooks/stripe - Handle Stripe webhook events
export async function POST(request: NextRequest) {
    if (!stripe) {
        console.error("STRIPE_SECRET_KEY is not configured")
        return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
    }
    if (!webhookSecret) {
        console.error("STRIPE_WEBHOOK_SECRET is not configured")
        return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    const body = await request.text()
    const headerPayload = await headers()
    const signature = headerPayload.get("stripe-signature")

    if (!signature) {
        return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
        console.error("Webhook signature verification failed:", err)
        return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as any
                await handleCheckoutCompleted(session)
                break
            }

            case "invoice.paid": {
                const invoice = event.data.object as any
                await handleInvoicePaid(invoice)
                break
            }

            case "invoice.payment_failed": {
                const invoice = event.data.object as any
                await handlePaymentFailed(invoice)
                break
            }

            case "customer.subscription.updated": {
                const subscription = event.data.object as any
                await handleSubscriptionUpdated(subscription)
                break
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object as any
                await handleSubscriptionDeleted(subscription)
                break
            }

            default:
                console.log(`Unhandled event type: ${event.type}`)
        }

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error("Error processing webhook:", error)
        return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
    }
}

// Handle successful checkout completion
async function handleCheckoutCompleted(session: any) {
    const userId = session.metadata?.userId
    const customerId = session.customer as string
    const subscriptionId = session.subscription as string

    if (!userId || !subscriptionId) {
        console.error("Missing userId or subscriptionId in checkout session metadata")
        return
    }

    // Get subscription details from Stripe
    const stripeSubscription = (await stripe!.subscriptions.retrieve(subscriptionId)) as any

    // Create subscription record in database
    const newSubscription = {
        id: crypto.randomUUID(),
        plan: "student",
        referenceId: userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: "ACTIVE",
        periodStart: new Date(stripeSubscription.current_period_start * 1000),
        periodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        seats: 1,
        trialStart: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
    }

    await db.insert(subscriptions).values([newSubscription])

    // Update user's subscription status
    await db
        .update(users)
        .set({
            subscriptionStatus: "ACTIVE" as SubscriptionStatus,
            subscriptionId: newSubscription.id,
            stripeCustomerId: customerId,
            updatedAt: new Date(),
        })
        .where(eq(users.id, userId))

    console.log(`Student subscription activated for user ${userId}`)
}

// Handle successful invoice payment (subscription renewal)
async function handleInvoicePaid(invoice: any) {
    const subscriptionId = invoice.subscription as string
    if (!subscriptionId) return

    // Find subscription in database
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
        .limit(1)

    if (!subscription) {
        console.log(`Subscription not found for invoice: ${invoice.id}`)
        return
    }

    // Get updated subscription from Stripe
    const stripeSubscription = (await stripe!.subscriptions.retrieve(subscriptionId)) as any

    // Update subscription period
    await db
        .update(subscriptions)
        .set({
            status: "ACTIVE",
            periodStart: new Date(stripeSubscription.current_period_start * 1000),
            periodEnd: new Date(stripeSubscription.current_period_end * 1000),
        })
        .where(eq(subscriptions.id, subscription.id))

    // Ensure user status is ACTIVE
    await db
        .update(users)
        .set({
            subscriptionStatus: "ACTIVE" as SubscriptionStatus,
            updatedAt: new Date(),
        })
        .where(eq(users.id, subscription.referenceId))

    console.log(`Subscription renewed for user ${subscription.referenceId}`)
}

// Handle failed payment
async function handlePaymentFailed(invoice: any) {
    const subscriptionId = invoice.subscription as string
    if (!subscriptionId) return

    // Find subscription in database
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
        .limit(1)

    if (!subscription) return

    // Update user status to PAST_DUE
    await db
        .update(users)
        .set({
            subscriptionStatus: "PAST_DUE" as SubscriptionStatus,
            updatedAt: new Date(),
        })
        .where(eq(users.id, subscription.referenceId))

    // Update subscription status
    await db
        .update(subscriptions)
        .set({ status: "PAST_DUE" })
        .where(eq(subscriptions.id, subscription.id))

    console.log(`Payment failed for user ${subscription.referenceId}`)
}

// Handle subscription updates
async function handleSubscriptionUpdated(stripeSubscription: any) {
    const subscriptionId = stripeSubscription.id

    // Find subscription in database
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
        .limit(1)

    if (!subscription) return

    // Map Stripe status to our status
    let status: SubscriptionStatus = "ACTIVE"
    if (stripeSubscription.status === "past_due") status = "PAST_DUE"
    else if (stripeSubscription.status === "canceled") status = "CANCELLED"
    else if (stripeSubscription.status === "trialing") status = "TRIAL"
    else if (stripeSubscription.status === "active") status = "ACTIVE"

    // Update subscription
    await db
        .update(subscriptions)
        .set({
            status: status,
            periodStart: new Date(stripeSubscription.current_period_start * 1000),
            periodEnd: new Date(stripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        })
        .where(eq(subscriptions.id, subscription.id))

    // Update user status
    await db
        .update(users)
        .set({
            subscriptionStatus: status,
            updatedAt: new Date(),
        })
        .where(eq(users.id, subscription.referenceId))

    console.log(`Subscription updated for user ${subscription.referenceId}: ${status}`)
}

// Handle subscription deletion
async function handleSubscriptionDeleted(stripeSubscription: any) {
    const subscriptionId = stripeSubscription.id

    // Find subscription in database
    const [subscription] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
        .limit(1)

    if (!subscription) return

    // Update subscription status
    await db
        .update(subscriptions)
        .set({ status: "CANCELLED" })
        .where(eq(subscriptions.id, subscription.id))

    // Update user status
    await db
        .update(users)
        .set({
            subscriptionStatus: "CANCELLED" as SubscriptionStatus,
            updatedAt: new Date(),
        })
        .where(eq(users.id, subscription.referenceId))

    console.log(`Subscription cancelled for user ${subscription.referenceId}`)
}
