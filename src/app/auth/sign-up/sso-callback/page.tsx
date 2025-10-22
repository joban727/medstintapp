import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card"

export default function SSOCallback() {
  // Check if we have valid Clerk keys
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const hasValidClerkKeys =
    publishableKey &&
    publishableKey !== "pk_test_placeholder" &&
    !publishableKey.includes("placeholder")

  if (!hasValidClerkKeys) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Authentication Unavailable</CardTitle>
            <CardDescription>SSO authentication is currently being configured.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Please contact your administrator or try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <AuthenticateWithRedirectCallback />
}
