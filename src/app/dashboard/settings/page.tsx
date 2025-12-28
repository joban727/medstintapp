import { UserProfile } from "@clerk/nextjs"
import type { Metadata } from "next"
import { PageHeader } from "../../../components/layout/page-header"
import { ResetAccountButton } from "@/components/settings/reset-account-button"

export const metadata: Metadata = {
  title: "Settings",
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account settings and preferences." />

      <div className="mx-auto max-w-3xl">
        <ResetAccountButton />
      </div>

      <div className="flex justify-center">
        <UserProfile
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-none border",
            },
          }}
        />
      </div>
    </div>
  )
}
