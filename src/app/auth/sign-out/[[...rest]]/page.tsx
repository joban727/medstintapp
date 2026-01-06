"use client"

import { useClerk } from "@clerk/nextjs"
import { useEffect } from "react"

export default function SignOutPage() {
  const { signOut } = useClerk()

  useEffect(() => {
    // Automatically sign out and redirect to home
    signOut({ redirectUrl: "/" })
  }, [signOut])

  return (
    <main className="container mx-auto flex grow flex-col items-center justify-center gap-4 self-center bg-background py-18 sm:py-22">
      <div className="text-center">
        <div className="mb-4 h-8 w-8 mx-auto animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        <h1 className="text-xl font-semibold">Signing out...</h1>
        <p className="text-muted-foreground mt-2">Please wait while we log you out.</p>
      </div>
    </main>
  )
}
