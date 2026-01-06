"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Edit, MoreHorizontal, Trash2, UserPlus } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/shared/data-table"
import { ActionBar, FilterGroup } from "@/components/shared/action-bar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { UserRole } from "@/types"

interface User {
  id: string
  name: string | null
  email: string
  role: UserRole | null
  schoolName: string | null
  createdAt: Date
}

interface School {
  id: string
  name: string
}

interface UsersTableClientProps {
  initialUsers: User[]
  accessibleSchools: School[]
}

const roleColors = {
  SUPER_ADMIN: "bg-purple-500/15 text-purple-500",
  SCHOOL_ADMIN: "bg-blue-500/15 text-blue-500",
  CLINICAL_PRECEPTOR: "bg-green-500/15 text-green-500",
  CLINICAL_SUPERVISOR: "bg-orange-500/15 text-orange-500",
  STUDENT: "bg-gray-500/15 text-gray-500",
}

const roleDisplayNames = {
  SUPER_ADMIN: "Super Admin",
  SCHOOL_ADMIN: "School Admin",
  CLINICAL_PRECEPTOR: "Clinical Preceptor",
  CLINICAL_SUPERVISOR: "Clinical Supervisor",
  STUDENT: "Student",
}

export function UsersTableClient({
  initialUsers = [],
  accessibleSchools = [],
}: UsersTableClientProps) {
  const router = useRouter()
  const [searchValue, setSearchValue] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [schoolFilter, setSchoolFilter] = useState<string>("all")

  // Filter users based on search and filters
  const filteredUsers = initialUsers.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchValue.toLowerCase()) ||
      user.email.toLowerCase().includes(searchValue.toLowerCase())

    const matchesRole = roleFilter === "all" || user.role === roleFilter

    // For school filter, we need to match school name since we only have schoolName in user object
    // In a real app, we'd probably want schoolId on the user object for better filtering
    const matchesSchool =
      schoolFilter === "all" ||
      (schoolFilter === "no-school" && !user.schoolName) ||
      accessibleSchools.find((s) => s.id === schoolFilter)?.name === user.schoolName

    return matchesSearch && matchesRole && matchesSchool
  })

  const filterGroups: FilterGroup[] = [
    {
      label: "Roles",
      options: ["All Roles", ...Object.values(roleDisplayNames)],
    },
    {
      label: "Schools",
      options: ["All Schools", ...accessibleSchools.map((s) => s.name)],
    },
  ]

  const handleFilterSelect = (value: string) => {
    // Map display names back to internal values or handle school names
    if (value === "All Roles") setRoleFilter("all")
    else if (value === "All Schools") setSchoolFilter("all")
    else {
      // Check if it's a role display name
      const roleEntry = Object.entries(roleDisplayNames).find(
        ([_, displayName]) => displayName === value
      )
      if (roleEntry) {
        setRoleFilter(roleEntry[0])
      } else {
        // Assume it's a school name
        const school = accessibleSchools.find((s) => s.name === value)
        if (school) setSchoolFilter(school.id)
      }
    }
  }

  const columns = [
    {
      key: "user",
      header: "User",
      render: (user: User) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={`https://avatar.vercel.sh/${user.email}`} />
            <AvatarFallback>{user.name?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-white">{user.name}</div>
            <div className="text-[var(--text-muted)] text-xs">{user.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (user: User) => (
        <Badge
          className={
            (user.role && roleColors[user.role as keyof typeof roleColors]) ||
            "bg-gray-500/15 text-gray-500"
          }
        >
          {(user.role && roleDisplayNames[user.role as keyof typeof roleDisplayNames]) ||
            user.role ||
            "No Role"}
        </Badge>
      ),
    },
    {
      key: "school",
      header: "School",
      render: (user: User) => (
        <span className="text-[var(--text-secondary)]">{user.schoolName || "No School"}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (user: User) => (
        <span className="text-[var(--text-muted)]">
          {new Date(user.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (user: User) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-[var(--text-muted)] hover:text-white"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="glass-dropdown">
            <DropdownMenuItem className="cursor-pointer hover:bg-white/5 focus:bg-white/5">
              <Edit className="mr-2 h-4 w-4" />
              Edit User
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-500 cursor-pointer hover:bg-red-500/10 focus:bg-red-500/10">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <ActionBar
        searchPlaceholder="Search users..."
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filterGroups={filterGroups}
        onFilterSelect={handleFilterSelect}
        addButtonLabel="Add User"
        onAddClick={() => {}}
      />

      <DataTable columns={columns} data={filteredUsers} />
    </div>
  )
}
