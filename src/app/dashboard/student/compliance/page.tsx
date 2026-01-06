import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import StudentComplianceClient from "@/components/dashboard/student/compliance-client"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageContainer } from "@/components/ui/page-container"

export default async function StudentCompliancePage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  return (
    <PageContainer>
      <Suspense fallback={<DashboardLoading />}>
        <StudentComplianceClient userId={userId} />
      </Suspense>
    </PageContainer>
  )
}
