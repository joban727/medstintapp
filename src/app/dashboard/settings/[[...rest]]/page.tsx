import { UserProfile } from "@clerk/nextjs"
import type { Metadata } from "next"
import { PageHeader } from "../../../../components/layout/page-header"
import { ResetAccountButton } from "@/components/settings/reset-account-button"
import { GlassSettings } from "@/components/settings/glass-settings"
import { GlassColorPicker } from "@/components/settings/glass-color-picker"
import { GlassFontPicker } from "@/components/settings/glass-font-picker"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Settings",
}

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Manage your account settings and preferences." />

      <div className="grid gap-8 md:grid-cols-2">
        {/* Theme Settings */}
        <div className="space-y-6">
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="text-white">Appearance</CardTitle>
              <CardDescription className="text-[var(--text-tertiary)]">
                Customize the look and feel of your dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white">Theme Color</h3>
                <GlassColorPicker />
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white">Font Family</h3>
                <GlassFontPicker />
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white">Glass Effect</h3>
                <GlassSettings />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-md border border-white/10 shadow-sm">
            <CardHeader>
              <CardTitle className="text-white">Danger Zone</CardTitle>
              <CardDescription className="text-[var(--text-tertiary)]">
                Irreversible account actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResetAccountButton />
            </CardContent>
          </Card>
        </div>

        {/* User Profile */}
        <div>
          <UserProfile
            routing="path"
            path="/dashboard/settings"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-white/5 backdrop-blur-md border border-white/10 shadow-sm w-full",
                navbar: "hidden",
                headerTitle: "text-white",
                headerSubtitle: "text-[var(--text-tertiary)]",
                profileSectionTitleText: "text-white",
                userPreviewMainIdentifier: "text-white",
                userPreviewSecondaryIdentifier: "text-[var(--text-tertiary)]",
              },
            }}
          />
        </div>
      </div>
    </div>
  )
}
