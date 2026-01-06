import { PageHeader } from "@/components/layout/page-header"
import { PlanForm } from "@/components/dashboard/admin/plans/plan-form"

export default function NewPlanPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Create New Plan" description="Add a new subscription plan." />
      <PlanForm />
    </div>
  )
}
