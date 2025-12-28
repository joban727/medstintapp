import { SignUp } from "@clerk/nextjs"
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

export const metadata: Metadata = {
  title: "Sign Up | MedStint",
  description: "Create a new MedStint account",
}

export default function SignUpPage() {
  // Check if we have valid Clerk keys
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const hasValidClerkKeys =
    publishableKey &&
    publishableKey !== "pk_test_placeholder" &&
    !publishableKey.includes("placeholder")

  return (
    <main className="container mx-auto flex grow flex-col items-center justify-center gap-4 self-center bg-background py-18 sm:py-22">
      <Link href="/" className="absolute top-6 left-8">
        <Button
          variant="outline"
          className="hover:bg-secondary hover:text-secondary-foreground"
          size="sm"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>

      <div className="w-full max-w-md">
        {!hasValidClerkKeys ? (
          <Card>
            <CardHeader>
              <CardTitle>Authentication Unavailable</CardTitle>
              <CardDescription>
                Authentication is currently being configured. Please check back later.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-sm">
                If you are an administrator, please configure the Clerk authentication keys.
              </p>
            </CardContent>
          </Card>
        ) : (
          <SignUp
            routing="path"
            path="/auth/sign-up"
            signInUrl="/auth/sign-in"
            fallbackRedirectUrl="/onboarding/user-type"
            appearance={{
              elements: {
                formButtonPrimary: "bg-primary hover:bg-primary/90",
                card: "shadow-lg",
              },
            }}
          />
        )}
      </div>

      {hasValidClerkKeys && (
        <div className="text-center text-muted-foreground text-sm">
          <p>
            By continuing, you agree to our{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
          </p>
        </div>
      )}
    </main>
  )
}
