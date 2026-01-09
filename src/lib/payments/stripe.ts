import Stripe from "stripe"

// Lazy Stripe initialization to prevent build-time errors
// Stripe will only be initialized when actually accessed at runtime
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY is not configured")
    }
    _stripe = new Stripe(apiKey, {
      apiVersion: "2025-08-27.basil",
      typescript: true,
    })
  }
  return _stripe
}

// Export a proxy for backward compatibility
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop]
  }
})
