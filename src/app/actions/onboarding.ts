"use server"

import { currentUser } from "@clerk/nextjs/server"
import { db } from "@/database/connection-pool"
import { users } from "@/database/schema"
import { eq } from "drizzle-orm"
import { invalidateUserCache } from "@/lib/auth-utils"

export async function skipOnboarding() {
  try {
    const user = await currentUser()
    console.log("skipOnboarding: userId", user?.id)
    if (!user?.id) throw new Error("Unauthorized")

    await db.update(users).set({ onboardingCompleted: true }).where(eq(users.id, user.id))

    // Invalidate middleware cache so user gets redirected to dashboard immediately
    invalidateUserCache(user.id)

    console.log("skipOnboarding: updated DB")
    return { success: true }
  } catch (e) {
    console.error("skipOnboarding: error", e)
    throw e
  }
}
