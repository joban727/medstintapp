"use client"

import { useUser as useClerkUser } from "@clerk/nextjs"

/**
 * Safe wrapper for Clerk's useUser hook that handles cases where Clerk is not available
 * Compatible with React 19
 */
export function useUser() {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  // Check if we have valid Clerk keys
  const hasValidClerkKeys =
    publishableKey &&
    publishableKey !== "pk_test_placeholder" &&
    !publishableKey.includes("placeholder")

  // Always call the Clerk hook unconditionally to follow React rules
  let clerkData
  try {
    clerkData = useClerkUser()
  } catch (error) {
    console.warn("Clerk useUser hook failed:", error)
    clerkData = null
  }

  // Return safe fallback if Clerk is not available or failed
  if (!hasValidClerkKeys || !clerkData) {
    return {
      user: null,
      isLoaded: true,
      isSignedIn: false,
    }
  }

  // Return the actual Clerk user data
  return clerkData
}
