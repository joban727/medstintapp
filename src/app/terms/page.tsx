import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "../../components/ui/button"

export const metadata: Metadata = {
  title: "Terms of Service - MedStint",
  description: "Terms of Service for MedStint",
}

export default function TermsPage() {
  return (
    <main className="container mx-auto max-w-4xl py-8">
      <Link href="/" className="mb-8 inline-flex items-center">
        <Button variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        <h1>Terms of Service</h1>

        <p className="text-lg text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing and using MedStint, you accept and agree to be bound by the terms and
          provision of this agreement.
        </p>

        <h2>2. Use License</h2>
        <p>
          Permission is granted to temporarily use MedStint for personal, non-commercial transitory
          viewing only. This is the grant of a license, not a transfer of title.
        </p>

        <h2>3. User Accounts</h2>
        <p>
          When you create an account with us, you must provide information that is accurate,
          complete, and current at all times. You are responsible for safeguarding the password and
          for all activities that occur under your account.
        </p>

        <h2>4. Privacy Policy</h2>
        <p>
          Your privacy is important to us. Please review our Privacy Policy, which also governs your
          use of the Service.
        </p>

        <h2>5. Prohibited Uses</h2>
        <p>
          You may not use our service for any unlawful purpose or to solicit others to perform
          unlawful acts.
        </p>

        <h2>6. Contact Information</h2>
        <p>If you have any questions about these Terms of Service, please contact us.</p>
      </div>
    </main>
  )
}
