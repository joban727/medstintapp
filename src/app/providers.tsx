"use client"

import { ClerkProvider } from "@clerk/nextjs"
import { ThemeProvider } from "next-themes"
import NextTopLoader from "nextjs-toploader"
import type { ReactNode } from "react"
import { Toaster } from "sonner"
import { EnhancedThemeProvider } from "@/contexts/theme-context"

export function Providers({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

  // Check if we have valid Clerk keys (not placeholders)
  const hasValidClerkKeys =
    publishableKey?.startsWith("pk_") &&
    publishableKey.length > 20 &&
    !publishableKey.includes("placeholder") &&
    !publishableKey.includes("your-key-here")

  const content = (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
      storageKey="medstint-theme"
    >
      <EnhancedThemeProvider>
        <NextTopLoader color="var(--primary)" showSpinner={false} />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            className: "theme-transition",
            style: {
              background: "hsl(var(--card))",
              color: "hsl(var(--card-foreground))",
              border: "1px solid hsl(var(--border))",
            },
          }}
        />
      </EnhancedThemeProvider>
    </ThemeProvider>
  )

  if (!hasValidClerkKeys) {
    // Return content without ClerkProvider if keys are invalid/missing
    return content
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/auth/sign-in"}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL || "/auth/sign-up"}
      signInFallbackRedirectUrl="/onboarding/user-type"
      signUpFallbackRedirectUrl="/onboarding/user-type"
      afterSignOutUrl="/"
    >
      {content}
    </ClerkProvider>
  )
}
