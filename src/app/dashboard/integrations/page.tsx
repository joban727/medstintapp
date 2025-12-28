import type { Metadata } from "next"
import { PageHeader } from "../../../components/layout/page-header"
import { IntegrationsClient } from "../../../components/dashboard/integrations-client"

export const metadata: Metadata = {
  title: "Integrations",
}

export default function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect your apps and services to your dashboard."
      />
      <IntegrationsClient />
    </div>
  )
}
