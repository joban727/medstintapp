import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import StudentEvaluationClient from "@/components/dashboard/student/evaluation-client"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageContainer } from "@/components/ui/page-container"

export default async function StudentEvaluationPage({
  searchParams,
}: {
  searchParams: { rotationId?: string }
}) {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  return (
    <PageContainer>
      <Suspense fallback={<DashboardLoading />}>
        <StudentEvaluationClient userId={userId} rotationId={searchParams.rotationId} />
      </Suspense>
    </PageContainer>
  )
}
