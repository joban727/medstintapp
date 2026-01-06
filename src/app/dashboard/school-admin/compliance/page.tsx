import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import AdminComplianceClient from "@/components/dashboard/school-admin/compliance-client"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageContainer } from "@/components/ui/page-container"

export default async function AdminCompliancePage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  return (
    <PageContainer>
      <Suspense fallback={<DashboardLoading />}>
        <AdminComplianceClient userId={userId} />
      </Suspense>
    </PageContainer>
  )
}
