import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { CompetencyProgressTracker } from "@/components/competency/competency-progress-tracker"
import { DashboardLoading } from "@/components/dashboard/dashboard-loading"
import { PageContainer } from "@/components/ui/page-container"
import { Separator } from "@/components/ui/separator"

export default async function StudentCompetenciesPage() {
  const { userId } = await auth()

  if (!userId) {
    redirect("/sign-in")
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Competencies</h1>
          <p className="text-muted-foreground">
            Track your progress across all assigned competencies.
          </p>
        </div>
        <Separator />
        <Suspense fallback={<DashboardLoading />}>
          <CompetencyProgressTracker studentId={userId} />
        </Suspense>
      </div>
    </PageContainer>
  )
}
