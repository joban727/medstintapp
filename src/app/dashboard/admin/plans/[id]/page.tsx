import { PageHeader } from "@/components/layout/page-header"
import { PlanForm } from "@/components/dashboard/admin/plans/plan-form"
import { getPlanById } from "@/lib/payments/plans-service"
import { notFound } from "next/navigation"

export default async function EditPlanPage({ params }: { params: { id: string } }) {
  const plan = await getPlanById(params.id)

  if (!plan) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Edit ${plan.name}`} description="Update plan details." />
      <PlanForm plan={plan} />
    </div>
  )
}
