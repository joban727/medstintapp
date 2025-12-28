"use server"

import { auth } from "@clerk/nextjs/server"
import { cookies } from "next/headers"
import { db } from "@/database/connection-pool"
import { users } from "@/database/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function resetAccount() {
  const { userId } = await auth()

  if (!userId) {
    throw new Error("Unauthorized")
  }

  try {
    await db
      .update(users)
      .set({
        onboardingCompleted: false,
        schoolId: null,
        // We keep the role so they don't have to re-select it if they are just testing the flow
        // But if they want a full reset, maybe we should clear role too?
        // The user said "reset account", usually implies starting over.
        // But clearing role might mess up if they are signed in as that role in Clerk?
        // Clerk doesn't store role in the user object usually, it's in metadata.
        // Let's keep role for now to be safe, or maybe clear it if they want to change role.
        // Let's just clear onboarding and schoolId as requested for "testing on this same account".
      })
      .where(eq(users.id, userId))

    // Set a cookie to tell middleware to bypass cache and refetch user data
    // This ensures the middleware sees the updated onboardingCompleted=false status
    const cookieStore = await cookies()
    cookieStore.set("cache_bypass_user", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60, // 1 minute - just needs to survive the redirect
      path: "/",
    })

    revalidatePath("/")
  } catch (error) {
    console.error("Failed to reset account:", error)
    throw new Error("Failed to reset account")
  }

  redirect("/onboarding")
}
