"use server"

import { db } from "@/database/connection-pool"
import { plans } from "@/database/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentUser } from "@/lib/auth-clerk"
import { stripe } from "@/lib/payments/stripe"

const planSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0), // in dollars
  interval: z.enum(["month", "year"]),
  stripePriceId: z.string().optional(), // Optional, generated if not provided
  type: z.enum(["STUDENT_SUBSCRIPTION", "SCHOOL_SEAT"]).default("STUDENT_SUBSCRIPTION"),
  features: z.array(z.string()),
  limits: z.record(z.string(), z.number()).optional(),
  trialDays: z.number().min(0).default(0),
  isActive: z.boolean().default(true),
})

export type PlanFormData = z.infer<typeof planSchema>

export async function createPlan(data: PlanFormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") {
    return { success: false, message: "Unauthorized" }
  }

  const result = planSchema.safeParse(data)
  if (!result.success) {
    return { success: false, message: "Invalid data", errors: result.error.flatten() }
  }

  let stripePriceId = result.data.stripePriceId

  try {
    // Auto-create Stripe Product & Price if not provided
    if (!stripePriceId && stripe) {
      const product = await stripe.products.create({
        name: result.data.name,
        description: result.data.description,
        metadata: {
          type: result.data.type,
        },
      })

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(result.data.price * 100),
        currency: "usd",
        recurring: {
          interval: result.data.interval,
        },
        metadata: {
          type: result.data.type,
        },
      })
      stripePriceId = price.id
    }

    if (!stripePriceId) {
      return { success: false, message: "Stripe Price ID is required or Stripe is not configured" }
    }

    await db.insert(plans).values({
      id: crypto.randomUUID(),
      ...result.data,
      stripePriceId,
      price: Math.round(result.data.price * 100), // convert to cents
      features: result.data.features, // jsonb
      limits: result.data.limits || {}, // jsonb
    })
    revalidatePath("/dashboard/admin/plans")
    return { success: true, message: "Plan created successfully" }
  } catch (error) {
    console.error("Error creating plan:", error)
    return { success: false, message: "Failed to create plan" }
  }
}

export async function updatePlan(id: string, data: Partial<PlanFormData>) {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") {
    return { success: false, message: "Unauthorized" }
  }

  try {
    const updateData: any = { ...data }

    // Handle Price Change -> Create New Stripe Price
    if (data.price !== undefined && stripe) {
      const [currentPlan] = await db.select().from(plans).where(eq(plans.id, id)).limit(1)

      if (currentPlan) {
        // Retrieve the product ID from the old price
        const oldPrice = await stripe.prices.retrieve(currentPlan.stripePriceId)

        if (oldPrice.product) {
          const newPrice = await stripe.prices.create({
            product: oldPrice.product as string,
            unit_amount: Math.round(data.price * 100),
            currency: "usd",
            recurring: {
              interval: data.interval || (currentPlan.interval as "month" | "year"),
            },
            metadata: {
              type: data.type || currentPlan.type,
            },
          })
          updateData.stripePriceId = newPrice.id
        }
      }
      updateData.price = Math.round(data.price * 100)
    }

    await db
      .update(plans)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(plans.id, id))

    revalidatePath("/dashboard/admin/plans")
    return { success: true, message: "Plan updated successfully" }
  } catch (error) {
    console.error("Error updating plan:", error)
    return { success: false, message: "Failed to update plan" }
  }
}

export async function deletePlan(id: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== "SUPER_ADMIN") {
    return { success: false, message: "Unauthorized" }
  }

  try {
    await db.update(plans).set({ isActive: false }).where(eq(plans.id, id))
    revalidatePath("/dashboard/admin/plans")
    return { success: true, message: "Plan deactivated successfully" }
  } catch (error) {
    console.error("Error deleting plan:", error)
    return { success: false, message: "Failed to delete plan" }
  }
}
