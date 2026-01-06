import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import AdminEvaluationClient from "@/components/dashboard/school-admin/evaluation-client"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageContainer } from "@/components/ui/page-container"

export default async function AdminEvaluationPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  return (
    <PageContainer>
      <Suspense fallback={<DashboardLoading />}>
        <AdminEvaluationClient userId={userId} />
      </Suspense>
    </PageContainer>
  )
}
