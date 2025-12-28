import { currentUser } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AssessmentCenter } from "../../../../components/competency/assessment-center"
import { PageHeader } from "../../../../components/layout/page-header"

export const metadata: Metadata = {
  title: "Assessments | MedStint",
  description: "View and manage student assessments",
}

export default async function AssessmentCenterPage() {
  const user = await currentUser()

  if (!user) {
    redirect("/auth/sign-in")
  }

  const userRole = user.publicMetadata?.role as string

  if (userRole !== "CLINICAL_SUPERVISOR") {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessment Center"
        description="Review and assess student competency submissions"
      />

      <AssessmentCenter supervisorId={user.id} />
    </div>
  )
}
