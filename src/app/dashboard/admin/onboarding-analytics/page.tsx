import type { Metadata } from "next"
import { OnboardingAnalyticsDashboard } from "@/components/onboarding-analytics-dashboard"
import { requireAnyRole } from "@/lib/auth-clerk"

export const metadata: Metadata = {
  title: "Onboarding Analytics | MedStint",
  description: "Analytics dashboard for user onboarding metrics",
}

export default async function OnboardingAnalyticsPage() {
  // Ensure only admins can access this page
  await requireAnyRole(["SUPER_ADMIN", "SCHOOL_ADMIN"])

  return (
    <div className="container mx-auto space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Onboarding Analytics</h1>
          <p className="text-muted-foreground">
            Monitor user onboarding completion rates and identify areas for improvement
          </p>
        </div>
      </div>

      <OnboardingAnalyticsDashboard />
    </div>
  )
}
