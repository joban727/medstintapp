import type { UserRole } from "@/types"

// Role hierarchy and permissions (Level 4 = highest, Level 1 = lowest)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  SUPER_ADMIN: 4,
  SCHOOL_ADMIN: 3,
  CLINICAL_PRECEPTOR: 2,
  CLINICAL_SUPERVISOR: 1.5,
  STUDENT: 1,
  SYSTEM: 5,
}

// Role display names
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Administrator",
  SCHOOL_ADMIN: "School Administrator",
  CLINICAL_SUPERVISOR: "Clinical Supervisor",
  CLINICAL_PRECEPTOR: "Clinical Preceptor",
  STUDENT: "Student",
  SYSTEM: "System",
}

// Role colors for UI
export const ROLE_COLORS: Record<UserRole, string> = {
  SUPER_ADMIN: "text-purple-600 bg-purple-100",
  SCHOOL_ADMIN: "text-blue-600 bg-blue-100",
  CLINICAL_SUPERVISOR: "text-green-600 bg-green-100",
  CLINICAL_PRECEPTOR: "text-orange-600 bg-orange-100",
  STUDENT: "text-gray-600 bg-gray-100",
  SYSTEM: "text-gray-600 bg-gray-100",
}

// Role-based route mapping
export const ROLE_ROUTES: Record<UserRole, string> = {
  SUPER_ADMIN: "/dashboard/admin",
  SCHOOL_ADMIN: "/dashboard/school-admin",
  CLINICAL_PRECEPTOR: "/dashboard/clinical-preceptor",
  CLINICAL_SUPERVISOR: "/dashboard/clinical-supervisor",
  STUDENT: "/dashboard/student",
  SYSTEM: "/",
}

// Permission definitions
export type Permission =
  | "manage_users"
  | "manage_schools"
  | "manage_programs"
  | "manage_competencies"
  | "manage_clinical_sites"
  | "view_all_students"
  | "manage_students"
  | "view_student_progress"
  | "manage_rotations"
  | "approve_timesheets"
  | "conduct_evaluations"
  | "validate_competencies"
  | "view_reports"
  | "generate_reports"
  | "manage_assessments"
  | "view_own_progress"
  | "submit_timesheets"
  | "view_own_evaluations"
  | "update_profile"
  | "manage_notifications"
  | "system_settings"
  | "audit_logs"
  | "submit_timecard_corrections"
  | "review_timecard_corrections"
  | "view_timecard_corrections"
  | "manage_timecard_corrections"
  | "view_dashboard"
  | "manage_sites"
  | "manage_locations"
  | "view_audit_logs"
  | "view_analytics"
  | "manage_billing"
  | "manage_onboarding"
  | "manage_webhooks"
  | "use_websocket"
  | "view_health_status"
  | "use_clock"
  | "view_student_dashboard"
  | "manage_user_profile"
  | "manage_facilities"
  | "manage_rotation_templates"
  | "manage_site_assignments"
  | "manage_notification_templates"
  | "manage_competency_submissions"
  | "view_competency_submissions"
  | "manage_competency_assignments"
  | "view_competency_assignments"
  | "manage_competency_templates"
  | "view_competency_analytics"
  | "manage_competency_notifications"
  | "view_competency_progress"
  | "manage_competency_deployments"
  | "manage_competency_assessments"
  | "view_school_context"
  | "manage_facility_cache"
  | "lookup_facilities"
  | "capture_location"
  | "verify_location"
  | "manage_location_permissions"
  | "manage_time_sync"
  | "poll_time_sync"
  | "connect_time_sync"
  | "view_time_sync_status"
  | "view_student_dashboard_stats"
  | "student_clock_in"
  | "student_clock_out"
  | "view_student_clock_status"
  | "manage_onboarding_session"
  | "view_onboarding_analytics"
  | "view_system_readiness"
  | "view_admin_performance"
  | "cleanup_mock_data"
  | "create_subscription"
  | "cancel_subscription"
  | "cancel_subscription"
  | "webhook_clerk"
  | "test_handler"
  | "test_auth"
  | "test_catchall"
  | "upload_files"
  | "view_schedule"
  | "manage_scheduled_reports"
  | "export_reports"
  | "view_time_records"
  | "manage_time_records"
  | "view_rotations"
  | "manage_preceptors"
  | "manage_evaluations"

// Role-based permissions
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    "manage_users",
    "manage_schools",
    "manage_programs",
    "manage_clinical_sites",
    "view_all_students",
    "manage_students",
    "view_student_progress",
    "manage_rotations",
    "approve_timesheets",
    "conduct_evaluations",
    "validate_competencies",
    "view_reports",
    "generate_reports",
    "manage_assessments",
    "manage_notifications",
    "system_settings",
    "audit_logs",
    "submit_timecard_corrections",
    "review_timecard_corrections",
    "view_timecard_corrections",
    "manage_timecard_corrections",
  ],
  SCHOOL_ADMIN: [
    "manage_students",
    "view_all_students",
    "view_student_progress",
    "manage_rotations",
    "approve_timesheets",
    "conduct_evaluations",
    "validate_competencies",
    "view_reports",
    "generate_reports",
    "manage_assessments",
    "update_profile",
    "manage_notifications",
    "review_timecard_corrections",
    "view_timecard_corrections",
    "manage_timecard_corrections",
  ],
  CLINICAL_PRECEPTOR: [
    "view_student_progress",
    "approve_timesheets",
    "conduct_evaluations",
    "validate_competencies",
    "manage_assessments",
    "view_reports",
    "update_profile",
    "review_timecard_corrections",
    "view_timecard_corrections",
  ],
  CLINICAL_SUPERVISOR: [
    "view_student_progress",
    "conduct_evaluations",
    "validate_competencies",
    "manage_assessments",
    "view_reports",
    "update_profile",
    "view_timecard_corrections",
  ],
  STUDENT: [
    "view_own_progress",
    "submit_timesheets",
    "view_own_evaluations",
    "update_profile",
    "submit_timecard_corrections",
    "view_timecard_corrections",
  ],

  SYSTEM: ["webhook_clerk"],
}

// Utility functions
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[userRole].includes(permission)
}

export function hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(userRole, permission))
}

export function hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(userRole, permission))
}

export function canAccessRole(userRole: UserRole, targetRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[targetRole]
}

export function getRoleDisplayName(role: UserRole): string {
  return ROLE_DISPLAY_NAMES[role]
}

export function getRoleColor(role: UserRole): string {
  return ROLE_COLORS[role]
}

export function getRoleRoute(role: UserRole): string {
  return ROLE_ROUTES[role]
}

export function isHigherRole(userRole: UserRole, compareRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] > ROLE_HIERARCHY[compareRole]
}

export function getAccessibleRoles(userRole: UserRole): UserRole[] {
  const userLevel = ROLE_HIERARCHY[userRole]
  return Object.entries(ROLE_HIERARCHY)
    .filter(([_, level]) => level <= userLevel)
    .map(([role, _]) => role as UserRole)
}

// Navigation items based on role
export interface NavigationItem {
  name: string
  href: string
  icon: string
  badge?: string
  children?: NavigationItem[]
  permissions?: Permission[]
}

export function getNavigationItems(userRole: UserRole): NavigationItem[] {
  const baseRoute = ROLE_ROUTES[userRole]

  const allItems: Record<UserRole, NavigationItem[]> = {
    SUPER_ADMIN: [
      {
        name: "Dashboard",
        href: `${baseRoute}`,
        icon: "LayoutDashboard",
      },
      {
        name: "Schools",
        href: `${baseRoute}/schools`,
        icon: "Building2",
        permissions: ["manage_schools"],
      },
      {
        name: "Users",
        href: `${baseRoute}/users`,
        icon: "Users",
        permissions: ["manage_users"],
      },
      {
        name: "Clinical Sites",
        href: `${baseRoute}/clinical-sites`,
        icon: "MapPin",
        permissions: ["manage_clinical_sites"],
      },
      {
        name: "Reports",
        href: `${baseRoute}/reports`,
        icon: "BarChart3",
        permissions: ["view_reports"],
      },
      {
        name: "Settings",
        href: `${baseRoute}/settings`,
        icon: "Settings",
        permissions: ["system_settings"],
      },
    ],
    SCHOOL_ADMIN: [
      {
        name: "Dashboard",
        href: `${baseRoute}`,
        icon: "LayoutDashboard",
      },
      {
        name: "Students",
        href: `${baseRoute}/students`,
        icon: "GraduationCap",
        permissions: ["manage_students"],
      },
      {
        name: "Faculty",
        href: `${baseRoute}/faculty`,
        icon: "Users",
        permissions: ["manage_users"],
      },
      {
        name: "Rotations",
        href: `${baseRoute}/rotations`,
        icon: "Calendar",
        permissions: ["manage_rotations"],
      },
      {
        name: "Evaluations",
        href: `${baseRoute}/evaluations`,
        icon: "ClipboardCheck",
        permissions: ["conduct_evaluations"],
      },
      {
        name: "Reports",
        href: `${baseRoute}/reports`,
        icon: "BarChart3",
        permissions: ["view_reports"],
      },
    ],
    CLINICAL_SUPERVISOR: [
      {
        name: "Dashboard",
        href: `${baseRoute}`,
        icon: "LayoutDashboard",
      },
      {
        name: "Assessments",
        href: `${baseRoute}/assessments`,
        icon: "Award",
        permissions: ["manage_assessments"],
      },
      {
        name: "Competencies",
        href: `${baseRoute}/competencies`,
        icon: "Target",
        permissions: ["validate_competencies"],
      },
      {
        name: "Students",
        href: `${baseRoute}/students`,
        icon: "Users",
        permissions: ["view_student_progress"],
      },
      {
        name: "Reports",
        href: `${baseRoute}/reports`,
        icon: "BarChart3",
        permissions: ["view_reports"],
      },
    ],
    CLINICAL_PRECEPTOR: [
      {
        name: "Dashboard",
        href: `${baseRoute}`,
        icon: "LayoutDashboard",
      },
      {
        name: "My Students",
        href: `${baseRoute}/students`,
        icon: "Users",
        permissions: ["view_student_progress"],
      },
      {
        name: "Competencies",
        href: `${baseRoute}/competencies`,
        icon: "Target",
        permissions: ["validate_competencies"],
      },
      {
        name: "Timesheets",
        href: `${baseRoute}/timesheets`,
        icon: "Clock",
        permissions: ["approve_timesheets"],
      },
      {
        name: "Evaluations",
        href: `${baseRoute}/evaluations`,
        icon: "ClipboardCheck",
        permissions: ["conduct_evaluations"],
      },
      {
        name: "Reports",
        href: `${baseRoute}/reports`,
        icon: "BarChart3",
        permissions: ["view_reports"],
      },
    ],
    STUDENT: [
      {
        name: "Dashboard",
        href: `${baseRoute}`,
        icon: "LayoutDashboard",
      },
      {
        name: "My Progress",
        href: `${baseRoute}/progress`,
        icon: "TrendingUp",
        permissions: ["view_own_progress"],
      },
      {
        name: "Timesheets",
        href: `${baseRoute}/timesheets`,
        icon: "Clock",
        permissions: ["submit_timesheets"],
      },
      {
        name: "Evaluations",
        href: `${baseRoute}/evaluations`,
        icon: "ClipboardCheck",
        permissions: ["view_own_evaluations"],
      },
      {
        name: "Competencies",
        href: `${baseRoute}/competencies`,
        icon: "Target",
        permissions: ["view_own_progress"],
      },
      {
        name: "Resources",
        href: `${baseRoute}/resources`,
        icon: "BookOpen",
      },

    ],
    SYSTEM: [],
  }

  return allItems[userRole].filter((item) => {
    if (!item.permissions) return true
    return hasAnyPermission(userRole, item.permissions)
  })
}

// Quick actions based on role
export interface QuickAction {
  name: string
  href: string
  icon: string
  color: string
  permissions?: Permission[]
}

export function getQuickActions(userRole: UserRole): QuickAction[] {
  const baseRoute = ROLE_ROUTES[userRole]

  const allActions: Record<UserRole, QuickAction[]> = {
    SUPER_ADMIN: [
      {
        name: "Add School",
        href: `${baseRoute}/schools/new`,
        icon: "Plus",
        color: "bg-blue-600 hover:bg-blue-700",
        permissions: ["manage_schools"],
      },
      {
        name: "Add User",
        href: `${baseRoute}/users/new`,
        icon: "UserPlus",
        color: "bg-green-600 hover:bg-green-700",
        permissions: ["manage_users"],
      },
      {
        name: "System Reports",
        href: `${baseRoute}/reports`,
        icon: "BarChart3",
        color: "bg-purple-600 hover:bg-purple-700",
        permissions: ["view_reports"],
      },
    ],
    SCHOOL_ADMIN: [
      {
        name: "Add Student",
        href: `${baseRoute}/students/new`,
        icon: "UserPlus",
        color: "bg-blue-600 hover:bg-blue-700",
        permissions: ["manage_students"],
      },
      {
        name: "Schedule Rotation",
        href: `${baseRoute}/rotations/new`,
        icon: "Calendar",
        color: "bg-green-600 hover:bg-green-700",
        permissions: ["manage_rotations"],
      },
      {
        name: "Generate Report",
        href: `${baseRoute}/reports/generate`,
        icon: "FileText",
        color: "bg-purple-600 hover:bg-purple-700",
        permissions: ["generate_reports"],
      },
    ],
    CLINICAL_SUPERVISOR: [
      {
        name: "New Assessment",
        href: `${baseRoute}/assessments/new`,
        icon: "Award",
        color: "bg-blue-600 hover:bg-blue-700",
        permissions: ["manage_assessments"],
      },
      {
        name: "Validate Skills",
        href: `${baseRoute}/competencies/validate`,
        icon: "CheckCircle",
        color: "bg-green-600 hover:bg-green-700",
        permissions: ["validate_competencies"],
      },
    ],
    CLINICAL_PRECEPTOR: [
      {
        name: "Review Timesheets",
        href: `${baseRoute}/timesheets/pending`,
        icon: "Clock",
        color: "bg-orange-600 hover:bg-orange-700",
        permissions: ["approve_timesheets"],
      },
      {
        name: "New Evaluation",
        href: `${baseRoute}/evaluations/new`,
        icon: "ClipboardCheck",
        color: "bg-blue-600 hover:bg-blue-700",
        permissions: ["conduct_evaluations"],
      },
    ],
    STUDENT: [
      {
        name: "Log Hours",
        href: `${baseRoute}/timesheets/new`,
        icon: "Clock",
        color: "bg-blue-600 hover:bg-blue-700",
        permissions: ["submit_timesheets"],
      },
      {
        name: "View Progress",
        href: `${baseRoute}/progress`,
        icon: "TrendingUp",
        color: "bg-green-600 hover:bg-green-700",
        permissions: ["view_own_progress"],
      },
    ],
    SYSTEM: [],
  }

  return allActions[userRole].filter((action) => {
    if (!action.permissions) return true
    return hasAnyPermission(userRole, action.permissions)
  })
}
