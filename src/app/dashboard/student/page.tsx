import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import StudentDashboardClient from "@/components/dashboard/student-dashboard-client"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageContainer } from "@/components/ui/page-container"

export default async function StudentDashboard() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  return (
    <PageContainer>
      <Suspense fallback={<DashboardLoading />}>
        <StudentDashboardClient userId={userId} />
      </Suspense>
    </PageContainer>
  )
}
