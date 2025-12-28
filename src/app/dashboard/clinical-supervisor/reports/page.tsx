"use client"

import { ComprehensiveReportsDashboard } from "@/components/reporting/comprehensive-reports-dashboard"

export default function ReportsPage() {
  return (
    <div className="container mx-auto py-6">
      <ComprehensiveReportsDashboard userRole="CLINICAL_SUPERVISOR" />
    </div>
  )
}
