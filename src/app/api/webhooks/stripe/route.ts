import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { stripe } from "@/lib/payments/stripe"
import { logger } from "@/lib/logger"
import {
  handleCheckoutCompleted,
  handleInvoicePaid,
  handlePaymentFailed,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
} from "@/lib/payments/actions"

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get("Stripe-Signature") as string

  if (!process.env.STRIPE_SECRET_KEY) {
    logger.error("STRIPE_SECRET_KEY is not configured")
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    logger.error("STRIPE_WEBHOOK_SECRET is not configured")
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  let event

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    logger.error({ error: err }, "Webhook signature verification failed")
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as any)
        break
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as any)
        break
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as any)
        break
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as any)
        break
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as any)
        break
      default:
        logger.warn(`Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    logger.error({ error }, "Error processing webhook")
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
