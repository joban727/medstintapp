import { UserPlus, Users, GraduationCap, Stethoscope, Activity, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { UsersTableClient } from "@/components/users/users-table-client"
import { requireAnyRole } from "@/lib/auth-clerk"
import type { UserRole } from "@/types"

export default async function UsersManagementPage() {
  const _user = await requireAnyRole(["SUPER_ADMIN"], "/dashboard")

  // Fetch all users with their school information using school-aware filtering
  const { getAllUsers, getAccessibleSchools } = await import("@/app/actions")
  const allUsers = await getAllUsers()
  const accessibleSchools = await getAccessibleSchools()

  // Calculate stats
  const totalUsers = allUsers.length
  const students = allUsers.filter((u) => u.role === ("STUDENT" as UserRole)).length
  const preceptors = allUsers.filter((u) => u.role === ("CLINICAL_PRECEPTOR" as UserRole)).length
  const supervisors = allUsers.filter((u) => u.role === ("CLINICAL_SUPERVISOR" as UserRole)).length
  const admins = allUsers.filter(
    (u) => u.role === ("SCHOOL_ADMIN" as UserRole) || u.role === ("SUPER_ADMIN" as UserRole)
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight text-white">User Management</h1>
          <p className="text-[var(--text-secondary)]">Manage all users across the platform</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white border-none">
          <UserPlus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Total Users"
          value={totalUsers}
          trend={{ value: 12, label: "vs last month" }}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard title="Students" value={students} icon={<GraduationCap className="h-5 w-5" />} />
        <StatCard
          title="Preceptors"
          value={preceptors}
          icon={<Stethoscope className="h-5 w-5" />}
        />
        <StatCard title="Supervisors" value={supervisors} icon={<Activity className="h-5 w-5" />} />
        <StatCard title="Admins" value={admins} icon={<Shield className="h-5 w-5" />} />
      </div>

      {/* Users Table Client Component */}
      <UsersTableClient initialUsers={allUsers} accessibleSchools={accessibleSchools} />
    </div>
  )
}
