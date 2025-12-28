"use server"

import Stripe from "stripe"
import { getCurrentUser } from "@/lib/auth-clerk"

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

const stripeClient = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null

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

  // TODO: Implement subscription retrieval with your payment provider
  return {
    subscription: null,
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

  if (!stripeClient) {
    return {
      status: false,
      message: "Stripe is not configured.",
    }
  }

  try {
    const subscription = await stripeClient.subscriptions.retrieve(subId)
    if (!subscription.items.data.length) {
      return {
        status: false,
        message: "Invalid subscription. No subscription items found!",
      }
    }

    await stripeClient.subscriptions.update(subId, {
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
