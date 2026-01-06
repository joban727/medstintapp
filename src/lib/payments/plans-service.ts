import { db } from "@/database/connection-pool"
import { plans } from "@/database/schema"
import { eq, and } from "drizzle-orm"

export interface Plan {
  id: string
  name: string
  description: string | null
  price: number
  interval: "month" | "year"
  stripePriceId: string
  type: "STUDENT_SUBSCRIPTION" | "SCHOOL_SEAT"
  features: string[]
  limits: Record<string, number>
  trialDays: number
  isActive: boolean
}

export async function getPlans(): Promise<Plan[]> {
  const dbPlans = await db.select().from(plans).where(eq(plans.isActive, true))

  return dbPlans.map((p) => ({
    ...p,
    price: p.price / 100, // Convert cents to dollars
    type: (p.type as "STUDENT_SUBSCRIPTION" | "SCHOOL_SEAT") || "STUDENT_SUBSCRIPTION",
    features: (p.features as string[]) || [],
    limits: (p.limits as Record<string, number>) || {},
    trialDays: p.trialDays || 0,
    interval: p.interval as "month" | "year",
  }))
}

export async function getAllPlans(): Promise<Plan[]> {
  const dbPlans = await db.select().from(plans)

  return dbPlans.map((p) => ({
    ...p,
    price: p.price / 100,
    type: (p.type as "STUDENT_SUBSCRIPTION" | "SCHOOL_SEAT") || "STUDENT_SUBSCRIPTION",
    features: (p.features as string[]) || [],
    limits: (p.limits as Record<string, number>) || {},
    trialDays: p.trialDays || 0,
    interval: p.interval as "month" | "year",
  }))
}

export async function getSchoolSeatPlans(): Promise<Plan[]> {
  const dbPlans = await db
    .select()
    .from(plans)
    .where(and(eq(plans.isActive, true), eq(plans.type, "SCHOOL_SEAT")))

  return dbPlans.map((p) => ({
    ...p,
    price: p.price / 100,
    type: (p.type as "STUDENT_SUBSCRIPTION" | "SCHOOL_SEAT") || "SCHOOL_SEAT",
    features: (p.features as string[]) || [],
    limits: (p.limits as Record<string, number>) || {},
    trialDays: p.trialDays || 0,
    interval: p.interval as "month" | "year",
  }))
}

export async function getStudentPlan(): Promise<Plan> {
  // Try to find a plan named "student"
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.name, "student"), eq(plans.isActive, true)))
    .limit(1)

  if (plan) {
    return {
      ...plan,
      price: plan.price / 100, // Convert cents to dollars
      type: (plan.type as "STUDENT_SUBSCRIPTION" | "SCHOOL_SEAT") || "STUDENT_SUBSCRIPTION",
      features: (plan.features as string[]) || [],
      limits: (plan.limits as Record<string, number>) || {},
      trialDays: plan.trialDays || 0,
      interval: plan.interval as "month" | "year",
    }
  }

  // Fallback to hardcoded if not found (for safety during migration)
  return {
    id: "student_fallback",
    name: "student",
    description: "Student Plan",
    price: 2.0,
    interval: "month",
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_STUDENT_PRICE_ID || "",
    type: "STUDENT_SUBSCRIPTION",
    features: ["Full platform access", "Time clock & tracking", "Rotation management"],
    limits: { tokens: 50 },
    trialDays: 0,
    isActive: true,
  }
}

export async function getPlanById(id: string): Promise<Plan | null> {
  const [plan] = await db.select().from(plans).where(eq(plans.id, id)).limit(1)
  if (!plan) return null

  return {
    ...plan,
    price: plan.price / 100, // Convert cents to dollars
    type: (plan.type as "STUDENT_SUBSCRIPTION" | "SCHOOL_SEAT") || "STUDENT_SUBSCRIPTION",
    features: (plan.features as string[]) || [],
    limits: (plan.limits as Record<string, number>) || {},
    trialDays: plan.trialDays || 0,
    interval: plan.interval as "month" | "year",
  }
}
