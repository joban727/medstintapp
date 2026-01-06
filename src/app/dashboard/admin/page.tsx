import { getSystemStats } from "@/lib/admin/stats-service"
import { AdminDashboardClient } from "@/components/dashboard/admin/admin-dashboard-client"
import { PageHeader } from "@/components/layout/page-header"
import { db } from "@/database/connection-pool"
import { schools } from "@/database/schema"
import { desc } from "drizzle-orm"

export default async function AdminDashboardPage() {
  const stats = await getSystemStats()

  // Fetch recent schools
  const recentSchools = await db.select().from(schools).orderBy(desc(schools.createdAt)).limit(5)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super Admin Dashboard"
        description="Platform overview, revenue tracking, and system management."
      />
      <AdminDashboardClient stats={stats} recentSchools={recentSchools} />
    </div>
  )
}
