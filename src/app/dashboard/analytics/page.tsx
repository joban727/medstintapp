import type { Metadata } from "next"
import { PageHeader } from "../../../components/layout/page-header"

export const metadata: Metadata = {
  title: "Analytics",
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics page"
        description="View detailed analytics and insights about your data."
      />
    </div>
  )
}
