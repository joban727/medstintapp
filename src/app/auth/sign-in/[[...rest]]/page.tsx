import { SignIn } from "@clerk/nextjs"
import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "../../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card"
import { AuthLayout } from "@/components/auth/auth-layout"

export const metadata: Metadata = {
  title: "Sign In | MedStint",
  description: "Sign in to your MedStint account",
}

// This is a simple sign-in page. The redirect after sign-in is controlled by:
// 1. NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL in .env (set to /dashboard)
// 2. The dashboard layout checks if user needs onboarding
export default function SignInPage() {
  // Check if we have valid Clerk keys
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const hasValidClerkKeys =
    publishableKey &&
    publishableKey !== "pk_test_placeholder" &&
    !publishableKey.includes("placeholder")

  return (
    <AuthLayout>
      <div className="flex flex-col gap-4">
        <Link href="/" className="self-start">
          <Button variant="glass" className="text-white hover:text-white/80" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>

        <div className="w-full">
          {!hasValidClerkKeys ? (
            <Card className="bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
              <CardHeader>
                <CardTitle className="text-white">Authentication Unavailable</CardTitle>
                <CardDescription className="text-[var(--text-tertiary)]">
                  Authentication is currently being configured. Please check back later.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-[var(--text-muted)] text-sm">
                  If you are an administrator, please configure the Clerk authentication keys.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-white/5 backdrop-blur-md border border-white/10 shadow-sm p-6">
              <SignIn
                routing="path"
                path="/auth/sign-in"
                signUpUrl="/auth/sign-up"
                fallbackRedirectUrl="/dashboard"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "bg-transparent shadow-none w-full p-0",
                    headerTitle: "text-white",
                    headerSubtitle: "text-[var(--text-tertiary)]",
                    socialButtonsBlockButton:
                      "bg-white/5 hover:bg-white/10 text-white border border-white/10 backdrop-blur-md transition-all duration-300",
                    socialButtonsBlockButtonText: "text-white",
                    dividerLine: "bg-white/10",
                    dividerText: "text-[var(--text-muted)]",
                    formFieldLabel: "text-[var(--text-secondary)]",
                    formFieldInput:
                      "bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus:bg-white/10 focus:border-white/20",
                    formButtonPrimary: "bg-theme-gradient hover:opacity-90 transition-opacity",
                    footerActionText: "text-[var(--text-muted)]",
                    footerActionLink: "text-white hover:text-white/80",
                    identityPreviewText: "text-white",
                    identityPreviewEditButton: "text-[var(--text-tertiary)] hover:text-white",
                  },
                }}
              />
            </div>
          )}
        </div>
      </div>
    </AuthLayout>
  )
}
