import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import StudentDashboardClient from "@/components/dashboard/student-dashboard-client"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"

export default async function StudentDashboard() {
  const { userId } = await auth()
  
  if (!userId) {
    redirect("/sign-in")
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<DashboardLoading />}>
        <StudentDashboardClient userId={userId} />
      </Suspense>
    </div>
  )
}
