interface PlanLimits {
  tokens: number
}

export interface Plan {
  id: number
  name: string
  priceId: string
  limits: PlanLimits
  features: string[]
  price: number
  trialDays: number
}

export const plans: Plan[] = [
  {
    id: 1,
    name: "basic",
    priceId: "price_1Rk2O8Q70YfWGPkSRnKl9edC",
    limits: {
      tokens: 100,
    },
    features: ["Up to 3 projects", "Basic analytics", "Email support", "1 GB storage"],
    price: 9.99,
    trialDays: 0,
  },
  {
    id: 2,
    name: "pro",
    priceId: "price_1Rk2OzQ70YfWGPkSD4IBXRDo",
    limits: {
      tokens: 300,
    },
    features: [
      "Gives you access to pro features!",
      "Upto 10 team members",
      "Upto 20 GB storage",
      "Upto 10 pages",
      "Phone & email support",
      "AI assistance",
    ],
    price: 29.99,
    trialDays: 0,
  },
  {
    id: 3,
    name: "Premium",
    priceId: "price_1RCQTRDYd93YQoGLLd7bh8Kf",
    limits: {
      tokens: 900,
    },
    features: ["Unlimited projects", "Advanced analytics", "Priority support", "100 GB storage"],
    price: 59.99,
    trialDays: 7,
  },
]

// Student-specific subscription plan ($2/month)
export const studentPlan: Plan = {
  id: 0, // Reserved ID for student plan
  name: "student",
  priceId: process.env.NEXT_PUBLIC_STRIPE_STUDENT_PRICE_ID || "price_STUDENT_PLACEHOLDER",
  limits: {
    tokens: 50,
  },
  features: [
    "Full platform access",
    "Time clock & tracking",
    "Rotation management",
    "Competency tracking",
    "Mobile-friendly interface",
  ],
  price: 2.00,
  trialDays: 0,
}

// Helper to get plan by name
export function getPlanByName(name: string): Plan | undefined {
  if (name === "student") return studentPlan
  return plans.find(p => p.name.toLowerCase() === name.toLowerCase())
}
