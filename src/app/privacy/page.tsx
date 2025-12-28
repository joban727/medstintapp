import { ArrowLeft } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "../../components/ui/button"

export const metadata: Metadata = {
  title: "Privacy Policy | MedStint",
  description: "Privacy policy for the MedStint platform",
}

export default function PrivacyPage() {
  return (
    <main className="container mx-auto max-w-4xl py-8">
      <Link href="/" className="mb-8 inline-flex items-center">
        <Button variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </Link>

      <div className="prose prose-gray dark:prose-invert max-w-none">
        <h1>Privacy Policy</h1>

        <p className="text-lg text-muted-foreground">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <h2>1. Information We Collect</h2>
        <p>
          We collect information you provide directly to us, such as when you create an account, use
          our services, or contact us for support.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>
          We use the information we collect to provide, maintain, and improve our services, process
          transactions, and communicate with you.
        </p>

        <h2>3. Information Sharing</h2>
        <p>
          We do not sell, trade, or otherwise transfer your personal information to third parties
          without your consent, except as described in this policy.
        </p>

        <h2>4. Data Security</h2>
        <p>
          We implement appropriate security measures to protect your personal information against
          unauthorized access, alteration, disclosure, or destruction.
        </p>

        <h2>5. Cookies</h2>
        <p>
          We use cookies and similar tracking technologies to enhance your experience on our
          platform.
        </p>

        <h2>6. Your Rights</h2>
        <p>
          You have the right to access, update, or delete your personal information. You may also
          opt out of certain communications from us.
        </p>

        <h2>7. Changes to This Policy</h2>
        <p>
          We may update this privacy policy from time to time. We will notify you of any changes by
          posting the new policy on this page.
        </p>

        <h2>8. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us.</p>
      </div>
    </main>
  )
}
