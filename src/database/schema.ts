import { sql } from "drizzle-orm"
import { boolean, check, decimal, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

// User role type
export type UserRole =
  | "SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "CLINICAL_PRECEPTOR"
  | "CLINICAL_SUPERVISOR"
  | "STUDENT"
  | "SYSTEM"

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  avatar: text("avatar"),
  avatarUrl: text("avatar_url"),
  role: text("role", {
    enum: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT", "SYSTEM"],
  }),
  schoolId: text("school_id"), // Reference to schools.id managed via relations
  department: text("department"),
  phone: text("phone"),
  address: text("address"),
  isActive: boolean("is_active").default(true).notNull(),
  approvalStatus: text("approval_status", {
    enum: ["PENDING", "APPROVED", "REJECTED"],
  })
    .default("PENDING")
    .notNull(),
  studentId: text("student_id"),
  programId: text("program_id"),
  cohortId: text("cohort_id"), // Reference to cohorts.id managed via relations
  enrollmentDate: timestamp("enrollment_date"),
  expectedGraduation: timestamp("expected_graduation"),
  academicStatus: text("academic_status", {
    enum: ["ACTIVE", "PROBATION", "SUSPENDED", "GRADUATED", "WITHDRAWN"],
  }),
  gpa: decimal("gpa", { precision: 3, scale: 2 }),
  totalClinicalHours: integer("total_clinical_hours").default(0),
  completedRotations: integer("completed_rotations").default(0),
  onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  // Student subscription tracking
  subscriptionStatus: text("subscription_status", {
    enum: ["NONE", "TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED", "GRANDFATHERED"],
  }).default("NONE"),
  subscriptionId: text("subscription_id"), // Reference to subscriptions.id
}, (table) => ({
  emailActiveIdx: uniqueIndex("users_email_active_idx").on(table.email, table.isActive),
  programIdx: index("users_program_idx").on(table.programId),
  schoolIdx: index("users_school_idx").on(table.schoolId),
  cohortIdx: index("users_cohort_idx").on(table.cohortId),
  subscriptionStatusIdx: index("users_subscription_status_idx").on(table.subscriptionStatus),
}))

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
})

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
})

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => /* @__PURE__ */ new Date()),
  updatedAt: timestamp("updated_at").$defaultFn(() => /* @__PURE__ */ new Date()),
})

export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(),
  plan: text("plan").notNull(),
  referenceId: text("reference_id").notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").default("incomplete"),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end"),
  seats: integer("seats"),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
})

export const accreditationOptions = pgTable("accreditation_options", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

// MedStint-specific tables
export const schools = pgTable("schools", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  accreditation: text("accreditation"),
  isActive: boolean("is_active").default(true).notNull(),
  adminId: text("admin_id").references(() => users.id),
  // Billing fields
  billingModel: text("billing_model", { enum: ["STUDENT_PAYS", "SCHOOL_PAYS"] })
    .default("STUDENT_PAYS")
    .notNull(),
  seatsLimit: integer("seats_limit").default(0).notNull(),
  seatsUsed: integer("seats_used").default(0).notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => ({
  seatsCheck: check("seats_check", sql`${table.seatsUsed} <= ${table.seatsLimit}`),
}))

export const seatAssignments = pgTable("seat_assignments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  studentId: text("student_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status", { enum: ["ACTIVE", "REVOKED"] })
    .default("ACTIVE")
    .notNull(),
  assignedAt: timestamp("assigned_at")
    .$defaultFn(() => new Date())
    .notNull(),
  revokedAt: timestamp("revoked_at"),
})

export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // Stripe Price ID or internal UUID
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(), // in cents
  interval: text("interval", { enum: ["month", "year"] }).notNull(),
  stripePriceId: text("stripe_price_id").notNull(),
  type: text("type", { enum: ["STUDENT_SUBSCRIPTION", "SCHOOL_SEAT"] })
    .default("STUDENT_SUBSCRIPTION")
    .notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  features: jsonb("features"), // Array of strings
  limits: jsonb("limits"), // Object with limits (e.g. { tokens: 100 })
  trialDays: integer("trial_days").default(0).notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const programs = pgTable("programs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type"), // e.g., "Medical Doctor (MD)", "General Radiology"
  description: text("description").notNull(),
  duration: integer("duration").notNull(), // in months
  classYear: integer("class_year").notNull(), // graduation year
  schoolId: text("school_id")
    .references(() => schools.id)
    .notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  requirements: text("requirements"), // JSON array
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => ({
  schoolIdx: index("programs_school_idx").on(table.schoolId),
}))

export const cohorts = pgTable("cohorts", {
  id: text("id").primaryKey(),
  programId: text("program_id")
    .references(() => programs.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(), // e.g., "Class of 2025"
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(), // Graduation date
  graduationYear: integer("graduation_year"), // e.g., 2025
  capacity: integer("capacity").notNull(),
  description: text("description"),
  status: text("status", { enum: ["ACTIVE", "GRADUATED", "ARCHIVED"] })
    .default("ACTIVE")
    .notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => ({
  programIdx: index("cohorts_program_idx").on(table.programId),
}))

export const clinicalSites = pgTable("clinical_sites", {
  id: text("id").primaryKey(),
  schoolId: text("school_id").references(() => schools.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  type: text("type", {
    enum: ["HOSPITAL", "CLINIC", "NURSING_HOME", "OUTPATIENT", "OTHER"],
  }).notNull(),
  capacity: integer("capacity").notNull(),
  specialties: text("specialties"), // JSON array
  isActive: boolean("is_active").default(true).notNull(),
  contactPersonName: text("contact_person_name"),
  contactPersonTitle: text("contact_person_title"),
  contactPersonPhone: text("contact_person_phone"),
  contactPersonEmail: text("contact_person_email"),
  requirements: text("requirements"), // JSON array
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

// Junction table linking Programs to Clinical Sites with optional rules/metadata
export const programClinicalSites = pgTable("program_clinical_sites", {
  id: text("id").primaryKey(),
  programId: text("program_id")
    .references(() => programs.id, { onDelete: "cascade" })
    .notNull(),
  clinicalSiteId: text("clinical_site_id")
    .references(() => clinicalSites.id, { onDelete: "cascade" })
    .notNull(),
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  priority: integer("priority").default(0).notNull(),
  capacityOverride: integer("capacity_override"),
  isDefault: boolean("is_default").default(false).notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  eligibilityRules: text("eligibility_rules"), // JSON object
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => ({
  uniqueProgramSite: uniqueIndex("program_clinical_sites_program_site_unique").on(
    table.programId,
    table.clinicalSiteId,
  ),
  programIdx: index("program_clinical_sites_program_idx").on(table.programId),
  siteIdx: index("program_clinical_sites_site_idx").on(table.clinicalSiteId),
  schoolIdx: index("program_clinical_sites_school_idx").on(table.schoolId),
  defaultIdx: index("program_clinical_sites_default_idx").on(table.isDefault),
  dateRangeIdx: index("program_clinical_sites_date_range_idx").on(table.startDate, table.endDate),
}))

// Rotation Templates - Defines reusable rotation patterns for cohorts
export const rotationTemplates = pgTable("rotation_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  programId: text("program_id")
    .references(() => programs.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(), // e.g., "General Radiology Rotation"
  description: text("description"),
  specialty: text("specialty").notNull(),
  defaultDurationWeeks: integer("default_duration_weeks").notNull(),
  defaultRequiredHours: integer("default_required_hours").notNull(),
  defaultClinicalSiteId: text("default_clinical_site_id")
    .references(() => clinicalSites.id, { onDelete: "set null" }),
  objectives: text("objectives"), // JSON array
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
}, (table) => ({
  schoolProgramIdx: index("rotation_templates_school_program_idx").on(table.schoolId, table.programId),
  specialtyIdx: index("rotation_templates_specialty_idx").on(table.specialty),
}))

// Cohort Rotation Assignments - Links rotation templates to cohorts with specific dates
export const cohortRotationAssignments = pgTable("cohort_rotation_assignments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  cohortId: text("cohort_id")
    .references(() => cohorts.id, { onDelete: "cascade" })
    .notNull(),
  rotationTemplateId: text("rotation_template_id")
    .references(() => rotationTemplates.id, { onDelete: "cascade" })
    .notNull(),
  clinicalSiteId: text("clinical_site_id")
    .references(() => clinicalSites.id, { onDelete: "set null" }),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  requiredHours: integer("required_hours").notNull(),
  maxStudents: integer("max_students"), // Optional capacity limit per site
  status: text("status", { enum: ["DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"] })
    .default("DRAFT").notNull(),
  notes: text("notes"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
}, (table) => ({
  cohortTemplateIdx: index("cohort_rotation_cohort_template_idx").on(table.cohortId, table.rotationTemplateId),
  dateRangeIdx: index("cohort_rotation_date_range_idx").on(table.startDate, table.endDate),
  statusIdx: index("cohort_rotation_status_idx").on(table.status),
}))

export const rotations = pgTable("rotations", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .references(() => users.id)
    .notNull(),
  clinicalSiteId: text("clinical_site_id")
    .references(() => clinicalSites.id)
    .notNull(),
  programId: text("program_id").references(() => programs.id),
  cohortId: text("cohort_id").references(() => cohorts.id),
  // Links to cohort rotation system
  cohortRotationAssignmentId: text("cohort_rotation_assignment_id")
    .references(() => cohortRotationAssignments.id, { onDelete: "set null" }),
  rotationTemplateId: text("rotation_template_id")
    .references(() => rotationTemplates.id, { onDelete: "set null" }),
  preceptorId: text("preceptor_id")
    .references(() => users.id), // Made optional to simplify onboarding
  supervisorId: text("supervisor_id").references(() => users.id),
  specialty: text("specialty").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  requiredHours: integer("required_hours"),
  completedHours: integer("completed_hours").default(0).notNull(),
  status: text("status", { enum: ["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"] })
    .default("SCHEDULED")
    .notNull(),
  objectives: text("objectives"), // JSON array of activities
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const timeRecords = pgTable("time_records", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: text("student_id")
    .references(() => users.id)
    .notNull(),
  rotationId: text("rotation_id")
    .references(() => rotations.id)
    .notNull(),
  clinicalPreceptorId: text("clinical_preceptor_id")
    .references(() => users.id, { onDelete: "set null" }),
  date: timestamp("date", { mode: "date" }).notNull(),
  clockIn: timestamp("clock_in", { withTimezone: true }),
  clockOut: timestamp("clock_out", { withTimezone: true }),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }),
  activities: text("activities"), // JSON array of activities
  notes: text("notes"),
  // IP and User Agent tracking
  clockInIpAddress: text("clock_in_ip_address"),
  clockInUserAgent: text("clock_in_user_agent"),
  clockOutIpAddress: text("clock_out_ip_address"),
  clockOutUserAgent: text("clock_out_user_agent"),
  // Location tracking fields
  clockInLatitude: text("clock_in_latitude"),
  clockInLongitude: text("clock_in_longitude"),
  clockOutLatitude: text("clock_out_latitude"),
  clockOutLongitude: text("clock_out_longitude"),
  clockInAccuracy: decimal("clock_in_accuracy", { precision: 8, scale: 2 }),
  clockOutAccuracy: decimal("clock_out_accuracy", { precision: 8, scale: 2 }),
  clockInSource: text("clock_in_source", { enum: ["gps", "network", "manual"] }),
  clockOutSource: text("clock_out_source", { enum: ["gps", "network", "manual"] }),
  // Status and approval
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED"] })
    .default("PENDING")
    .notNull(),
  approvedBy: text("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => ({
  // Unique constraint to prevent multiple active clock-in records for the same student
  uniqueActiveClockIn: uniqueIndex("unique_active_clock_in")
    .on(table.studentId)
    .where(sql`${table.clockOut} IS NULL`),
  // Performance indexes for common queries
  studentDateIdx: index("time_records_student_date_idx").on(table.studentId, table.date),
  rotationStatusIdx: index("time_records_rotation_status_idx").on(table.rotationId, table.status),
  dateRangeIdx: index("time_records_date_range_idx").on(table.date),
  approvalIdx: index("time_records_approval_idx").on(table.approvedBy, table.approvedAt),
  // Added composite indexes for performance-critical filters
  studentStatusIdx: index("time_records_student_id_status_idx").on(table.studentId, table.status),
  preceptorStatusIdx: index("time_records_clinical_preceptor_id_status_idx").on(table.clinicalPreceptorId, table.status),
  studentClockInIdx: index("time_records_student_clock_in_idx").on(table.studentId, table.clockIn),
  rotationClockInIdx: index("time_records_rotation_clock_in_idx").on(table.rotationId, table.clockIn),
  studentClockOutIdx: index("time_records_student_clock_out_idx").on(table.studentId, table.clockOut),
}))

export const competencyTemplates = pgTable("competency_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  level: text("level", { enum: ["FUNDAMENTAL", "INTERMEDIATE", "ADVANCED", "EXPERT"] }).notNull(),
  type: text("type", { enum: ["COMPETENCY", "RUBRIC"] }).notNull(),
  content: text("content"), // JSON object
  tags: text("tags"), // JSON array
  isPublic: boolean("is_public").default(false).notNull(),
  source: text("source", { enum: ["STANDARD", "CUSTOM"] }).notNull(),
  version: text("version").default("1.0").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  metadata: text("metadata"), // JSON object
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const rubricCriteria = pgTable("rubric_criteria", {
  id: text("id").primaryKey(),
  competencyId: text("competency_id").references(() => competencies.id, { onDelete: "cascade" }),
  templateId: text("template_id").references(() => competencyTemplates.id, { onDelete: "cascade" }),
  criterionName: text("criterion_name").notNull(),
  description: text("description").notNull(),
  weight: decimal("weight", { precision: 5, scale: 2 }).default("1.0").notNull(),
  maxScore: decimal("max_score", { precision: 5, scale: 2 }).default("5.0").notNull(),
  performanceLevels: text("performance_levels").notNull(), // JSON array
  orderIndex: integer("order_index").default(0).notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const competencyDeployments = pgTable("competency_deployments", {
  id: text("id").primaryKey(),
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  templateId: text("template_id").references(() => competencyTemplates.id),
  competencyId: text("competency_id").references(() => competencies.id),
  deploymentType: text("deployment_type", {
    enum: ["TEMPLATE_IMPORT", "CUSTOM_CREATION", "BULK_IMPORT"],
  }).notNull(),
  status: text("status", { enum: ["PENDING", "ACTIVE", "INACTIVE", "ARCHIVED"] })
    .default("PENDING")
    .notNull(),
  deployedBy: text("deployed_by")
    .references(() => users.id)
    .notNull(),
  deployedAt: timestamp("deployed_at")
    .$defaultFn(() => new Date())
    .notNull(),
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"),
  targetPrograms: text("target_programs"), // JSON array of program IDs
  targetUsers: text("target_users"), // JSON array of user IDs
  rollbackData: text("rollback_data"), // JSON object
  notes: text("notes"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const notificationTemplates = pgTable("notification_templates", {
  id: text("id").primaryKey(),
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  type: text("type", { enum: ["EMAIL", "SMS", "IN_APP", "PUSH"] }).notNull(),
  subject: text("subject"),
  content: text("content").notNull(),
  variables: text("variables"), // JSON array of available variables
  isActive: boolean("is_active").default(true).notNull(),
  triggerEvent: text("trigger_event", {
    enum: [
      "DEPLOYMENT_CREATED",
      "DEPLOYMENT_UPDATED",
      "ASSIGNMENT_DUE",
      "ASSESSMENT_COMPLETED",
      "REMINDER",
    ],
  }).notNull(),
  recipientType: text("recipient_type", {
    enum: ["STUDENT", "SUPERVISOR", "ADMIN", "ALL"],
  }).notNull(),
  scheduledDelay: integer("scheduled_delay").default(0), // minutes
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "set null" }),
  clinicalSiteId: text("clinical_site_id").references(() => clinicalSites.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

export const competencyAssignments = pgTable("competency_assignments", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  competencyId: text("competency_id")
    .references(() => competencies.id, { onDelete: "cascade" })
    .notNull(),
  deploymentId: text("deployment_id").references(() => competencyDeployments.id),
  programId: text("program_id").references(() => programs.id),
  assignedBy: text("assigned_by")
    .references(() => users.id)
    .notNull(),
  assignmentType: text("assignment_type", {
    enum: ["REQUIRED", "OPTIONAL", "SUPPLEMENTARY"],
  }).notNull(),
  status: text("status", { enum: ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "OVERDUE"] })
    .default("ASSIGNED")
    .notNull(),
  dueDate: timestamp("due_date"),
  completionDate: timestamp("completion_date"),
  progressPercentage: decimal("progress_percentage", { precision: 5, scale: 2 }).default("0.0"),
  notes: text("notes"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const competencyVersions = pgTable("competency_versions", {
  id: text("id").primaryKey(),
  competencyId: text("competency_id")
    .references(() => competencies.id, { onDelete: "cascade" })
    .notNull(),
  versionNumber: text("version_number").notNull(),
  changesSummary: text("changes_summary").notNull(),
  previousData: text("previous_data").notNull(), // JSON snapshot
  createdBy: text("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const importExportLogs = pgTable("import_export_logs", {
  id: text("id").primaryKey(),
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  operationType: text("operation_type", { enum: ["IMPORT", "EXPORT"] }).notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  recordsProcessed: integer("records_processed").default(0),
  recordsSuccessful: integer("records_successful").default(0),
  recordsFailed: integer("records_failed").default(0),
  status: text("status", { enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] })
    .default("PENDING")
    .notNull(),
  errorDetails: text("error_details"), // JSON array
  processedBy: text("processed_by")
    .references(() => users.id)
    .notNull(),
  startedAt: timestamp("started_at")
    .$defaultFn(() => new Date())
    .notNull(),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const competencies = pgTable("competencies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  level: text("level", { enum: ["FUNDAMENTAL", "INTERMEDIATE", "ADVANCED", "EXPERT"] }).notNull(),
  isRequired: boolean("is_required").default(false).notNull(),
  programId: text("program_id").references(() => programs.id),
  criteria: text("criteria"), // JSON array
  templateId: text("template_id").references(() => competencyTemplates.id),
  schoolId: text("school_id").references(() => schools.id),
  version: text("version").default("1.0"),
  source: text("source", { enum: ["TEMPLATE", "CUSTOM"] }).default("CUSTOM"),
  isDeployed: boolean("is_deployed").default(false),
  deploymentScope: text("deployment_scope", {
    enum: ["SCHOOL_WIDE", "PROGRAM_SPECIFIC", "USER_SPECIFIC"],
  }).default("PROGRAM_SPECIFIC"),
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const competencySubmissions = pgTable("competency_submissions", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .references(() => users.id)
    .notNull(),
  competencyId: text("competency_id")
    .references(() => competencies.id)
    .notNull(),
  submittedBy: text("submitted_by")
    .references(() => users.id)
    .notNull(),
  assessmentId: text("assessment_id").references(() => assessments.id),
  evaluationId: text("evaluation_id").references(() => evaluations.id),
  rotationId: text("rotation_id").references(() => rotations.id),
  status: text("status", {
    enum: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "REQUIRES_REVISION"],
  })
    .default("SUBMITTED")
    .notNull(),
  submissionType: text("submission_type", { enum: ["INDIVIDUAL", "BATCH"] })
    .default("INDIVIDUAL")
    .notNull(),
  evidence: text("evidence"), // JSON array of evidence/documentation
  notes: text("notes"),
  feedback: text("feedback"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  submittedAt: timestamp("submitted_at")
    .$defaultFn(() => new Date())
    .notNull(),
  dueDate: timestamp("due_date"),
  completionDate: timestamp("completion_date"),
  metadata: text("metadata"), // JSON object for additional data
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const assessments = pgTable("assessments", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .references(() => users.id)
    .notNull(),
  competencyId: text("competency_id")
    .references(() => competencies.id)
    .notNull(),
  assessorId: text("assessor_id")
    .references(() => users.id)
    .notNull(),
  rotationId: text("rotation_id").references(() => rotations.id),
  type: text("type", { enum: ["INITIAL", "FORMATIVE", "SUMMATIVE", "FINAL"] }).notNull(),
  method: text("method", {
    enum: ["OBSERVATION", "SIMULATION", "ORAL_EXAM", "WRITTEN_EXAM", "PRACTICAL"],
  }).notNull(),
  date: timestamp("date").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }).notNull(),
  maxScore: decimal("max_score", { precision: 5, scale: 2 }).notNull(),
  passed: boolean("passed").notNull(),
  attempts: integer("attempts").default(1).notNull(),
  feedback: text("feedback").notNull(),
  recommendations: text("recommendations"),
  nextAssessmentDate: timestamp("next_assessment_date"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const evaluations = pgTable("evaluations", {
  id: text("id").primaryKey(),
  assignmentId: text("assignment_id")
    .references(() => competencyAssignments.id)
    .notNull(),
  studentId: text("student_id")
    .references(() => users.id)
    .notNull(),
  rotationId: text("rotation_id")
    .references(() => rotations.id)
    .notNull(),
  evaluatorId: text("evaluator_id")
    .references(() => users.id)
    .notNull(),
  clinicalSiteId: text("clinical_site_id").references(() => clinicalSites.id),
  type: text("type", { enum: ["MIDTERM", "FINAL", "WEEKLY", "INCIDENT"] }),
  period: text("period"),
  observationDate: timestamp("observation_date").notNull(),
  feedback: text("feedback"),
  overallRating: decimal("overall_rating", { precision: 3, scale: 2 }).notNull(),
  criteria: text("criteria"), // JSON object
  metadata: text("metadata"), // JSON object
  clinicalSkills: decimal("clinical_skills", { precision: 3, scale: 2 }).notNull(),
  communication: decimal("communication", { precision: 3, scale: 2 }).notNull(),
  professionalism: decimal("professionalism", { precision: 3, scale: 2 }).notNull(),
  criticalThinking: decimal("critical_thinking", { precision: 3, scale: 2 }).notNull(),
  strengths: text("strengths"),
  areasForImprovement: text("areas_for_improvement"),
  goals: text("goals"),
  comments: text("comments"),
  studentSignature: boolean("student_signature").default(false),
  evaluatorSignature: boolean("evaluator_signature").default(false),
  signedAt: timestamp("signed_at"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  action: text("action").notNull(),
  resource: text("resource"),
  resourceId: text("resource_id"),
  details: text("details"), // JSON object with additional context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  sessionId: text("session_id"),
  severity: text("severity", { enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] })
    .default("LOW")
    .notNull(),
  status: text("status", { enum: ["SUCCESS", "FAILURE", "ERROR"] })
    .default("SUCCESS")
    .notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const timecardCorrections = pgTable("timecard_corrections", {
  id: text("id").primaryKey(),
  originalTimeRecordId: text("original_time_record_id")
    .references(() => timeRecords.id)
    .notNull(),
  studentId: text("student_id")
    .references(() => users.id)
    .notNull(),
  rotationId: text("rotation_id")
    .references(() => rotations.id)
    .notNull(),
  correctionType: text("correction_type", {
    enum: ["CLOCK_IN_TIME", "CLOCK_OUT_TIME", "ACTIVITIES", "NOTES", "DATE", "MULTIPLE"],
  }).notNull(),
  requestedChanges: text("requested_changes").notNull(), // JSON object with field changes
  reason: text("reason").notNull(),
  studentNotes: text("student_notes"),
  status: text("status", {
    enum: ["PENDING", "APPROVED", "REJECTED", "APPLIED"],
  })
    .default("PENDING")
    .notNull(),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewerNotes: text("reviewer_notes"),
  appliedBy: text("applied_by").references(() => users.id),
  appliedAt: timestamp("applied_at"),
  originalData: text("original_data").notNull(), // JSON snapshot of original record
  priority: text("priority", { enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] })
    .default("MEDIUM")
    .notNull(),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const jobs = pgTable("jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type").notNull(), // e.g., 'EMAIL', 'REPORT'
  payload: jsonb("payload").notNull(),
  status: text("status", { enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"] })
    .default("PENDING")
    .notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  lastError: text("last_error"),
  runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => ({
  statusIdx: index("jobs_status_idx").on(table.status),
  runAtIdx: index("jobs_run_at_idx").on(table.runAt),
  typeIdx: index("jobs_type_idx").on(table.type),
}))

// Competency Tracking System Tables
export const progressSnapshots = pgTable("progress_snapshots", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  competencyId: text("competency_id")
    .notNull()
    .references(() => competencies.id, { onDelete: "cascade" }),
  assignmentId: text("assignment_id")
    .notNull()
    .references(() => competencyAssignments.id, { onDelete: "cascade" }),
  progressPercentage: decimal("progress_percentage", { precision: 5, scale: 2 })
    .default("0")
    .notNull(),
  status: text("status").default("ACTIVE").notNull(),
  snapshotDate: timestamp("snapshot_date").notNull(),
  metadata: text("metadata"), // JSON
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const learningAnalytics = pgTable("learning_analytics", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  competencyId: text("competency_id").references(() => competencies.id, { onDelete: "set null" }),
  programId: text("program_id").references(() => programs.id, { onDelete: "set null" }),
  schoolId: text("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  metricType: text("metric_type").notNull(),
  metricValue: decimal("metric_value", { precision: 10, scale: 2 }).notNull(),
  timePeriod: text("time_period").notNull(),
  aggregationLevel: text("aggregation_level").notNull(),
  metadata: text("metadata"), // JSON
  recordedAt: timestamp("recorded_at")
    .$defaultFn(() => new Date())
    .notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const notificationQueue = pgTable("notification_queue", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  notificationType: text("notification_type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: text("priority").default("MEDIUM").notNull(),
  status: text("status").default("PENDING").notNull(),
  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),
  metadata: text("metadata"), // JSON
  scheduledFor: timestamp("scheduled_for"),
  sentAt: timestamp("sent_at"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const reportCache = pgTable("report_cache", {
  id: text("id").primaryKey(),
  reportType: text("report_type").notNull(),
  cacheKey: text("cache_key").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  schoolId: text("school_id").references(() => schools.id, { onDelete: "cascade" }),
  programId: text("program_id").references(() => programs.id, { onDelete: "cascade" }),
  filters: text("filters"), // JSON
  data: text("data").notNull(), // JSON
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull(),
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  programId: text("program_id")
    .references(() => programs.id, { onDelete: "cascade" })
    .notNull(),
  cohortId: text("cohort_id")
    .references(() => cohorts.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role", { enum: ["STUDENT", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR"] }).default("STUDENT").notNull(),
  token: text("token").notNull().unique(),
  status: text("status", { enum: ["PENDING", "ACCEPTED", "EXPIRED"] })
    .default("PENDING")
    .notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  invitedBy: text("invited_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
}, (table) => ({
  emailSchoolIdx: index("invitations_email_school_idx").on(table.email, table.schoolId),
  tokenIdx: uniqueIndex("invitations_token_idx").on(table.token),
}))

export const competencyRubrics = pgTable("competency_rubrics", {
  id: text("id").primaryKey(),
  competencyId: text("competency_id")
    .notNull()
    .references(() => competencies.id, { onDelete: "cascade" }),
  schoolId: text("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  criteria: text("criteria").notNull(), // JSON
  scoringScale: text("scoring_scale").notNull(), // JSON
  version: text("version").default("1.0").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

// Site Assignment Table for Clock System
export const siteAssignments = pgTable("site_assignments", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  clinicalSiteId: text("clinical_site_id")
    .references(() => clinicalSites.id, { onDelete: "cascade" })
    .notNull(),
  rotationId: text("rotation_id").references(() => rotations.id, { onDelete: "cascade" }),
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status", { enum: ["ACTIVE", "INACTIVE", "COMPLETED", "CANCELLED"] })
    .default("ACTIVE")
    .notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  assignedBy: text("assigned_by")
    .references(() => users.id)
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

// Scheduled Reports Table
export const scheduledReports = pgTable("scheduled_reports", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["progress", "competency_analytics", "assessment_summary"],
  }).notNull(),
  frequency: text("frequency", { enum: ["daily", "weekly", "monthly", "quarterly"] }).notNull(),
  recipients: text("recipients").notNull(), // JSON array of email addresses
  format: text("format", { enum: ["pdf", "excel"] }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  filters: text("filters"), // JSON object for report filters
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  runCount: integer("run_count").default(0).notNull(),
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run").notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
})

// Duplicate removed - using Neon-compatible version below

// Onboarding Session Management Table - Neon Compatible
export const onboardingSessions = pgTable("onboarding_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  currentStep: text("current_step").notNull(),
  completedSteps: text("completed_steps").array().default(sql`'{}'`), // Array of completed step names
  formData: jsonb("form_data").default(sql`'{}'`), // JSON object with all form data
  metadata: jsonb("metadata").default(sql`'{}'`), // Additional session metadata
  expiresAt: timestamp("expires_at", { withTimezone: true })
    .default(sql`NOW() + INTERVAL '7 days'`)
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Onboarding Analytics Table - Neon Compatible
export const onboardingAnalytics = pgTable("onboarding_analytics", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sessionId: text("session_id").references(() => onboardingSessions.id, { onDelete: "set null" }),
  eventType: text("event_type").notNull(),
  step: text("step").notNull(),
  durationMs: integer("duration_ms"),
  metadata: jsonb("metadata").default(sql`'{}'`),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Real-Time Clock Synchronization System Tables - Neon Compatible

// Time sync session tracking
export const timeSyncSessions = pgTable("time_sync_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id").notNull().unique(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time", { withTimezone: true }).default(sql`NOW()`).notNull(),
  lastSync: timestamp("last_sync", { withTimezone: true }).default(sql`NOW()`).notNull(),
  protocol: text("protocol", { enum: ["sse", "longpoll", "websocket"] }).notNull(),
  status: text("status", { enum: ["active", "inactive", "error"] }).default("active").notNull(),
  driftMs: integer("drift_ms").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Sync event tracking
export const syncEvents = pgTable("sync_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id")
    .references(() => timeSyncSessions.id, { onDelete: "cascade" })
    .notNull(),
  eventType: text("event_type").notNull(),
  serverTime: timestamp("server_time", { withTimezone: true }).notNull(),
  clientTime: timestamp("client_time", { withTimezone: true }).notNull(),
  driftMs: integer("drift_ms").notNull(),
  metadata: jsonb("metadata").default(sql`'{}'`),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Connection logging
export const connectionLogs = pgTable("connection_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sessionId: text("session_id")
    .references(() => timeSyncSessions.id, { onDelete: "cascade" })
    .notNull(),
  eventType: text("event_type").notNull(),
  protocol: text("protocol").notNull(),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata").default(sql`'{}'`),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Synchronized clock records with enhanced precision
export const synchronizedClockRecords = pgTable("synchronized_clock_records", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  timeRecordId: text("time_record_id")
    .references(() => timeRecords.id, { onDelete: "cascade" })
    .notNull(),
  sessionId: text("session_id")
    .references(() => timeSyncSessions.id, { onDelete: "set null" }),
  syncedClockIn: timestamp("synced_clock_in", { withTimezone: true }),
  syncedClockOut: timestamp("synced_clock_out", { withTimezone: true }),
  clockInDriftMs: integer("clock_in_drift_ms").default(0),
  clockOutDriftMs: integer("clock_out_drift_ms").default(0),
  syncAccuracy: text("sync_accuracy", { enum: ["high", "medium", "low"] }).default("medium"),
  verificationStatus: text("verification_status", { enum: ["verified", "pending", "failed"] }).default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Location Tracking System Tables - Neon Compatible

// Clinical site locations for geofencing
export const clinicalSiteLocations = pgTable("clinical_site_locations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clinicalSiteId: text("clinical_site_id")
    .references(() => clinicalSites.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(), // e.g., "Main Building", "Emergency Department"
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  radius: integer("radius").default(100).notNull(), // meters
  strictGeofence: boolean("strict_geofence").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isPrimary: boolean("is_primary").default(false).notNull(), // primary location for the site
  description: text("description"),
  floor: text("floor"), // building floor if applicable
  department: text("department"), // specific department
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Location verification logs
export const locationVerifications = pgTable("location_verifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  timeRecordId: text("time_record_id")
    .references(() => timeRecords.id, { onDelete: "cascade" })
    .notNull(),
  clinicalSiteLocationId: text("clinical_site_location_id")
    .references(() => clinicalSiteLocations.id, { onDelete: "set null" }),
  verificationTime: timestamp("verification_time", { withTimezone: true }).default(sql`NOW()`).notNull(),
  verificationType: text("verification_type", { enum: ["clock_in", "clock_out"] }).notNull(),
  userLatitude: decimal("user_latitude", { precision: 10, scale: 8 }).notNull(),
  userLongitude: decimal("user_longitude", { precision: 11, scale: 8 }).notNull(),
  userAccuracy: decimal("user_accuracy", { precision: 8, scale: 2 }), // meters
  locationSource: text("location_source", { enum: ["gps", "network", "manual"] }).notNull(),
  distanceFromSite: decimal("distance_from_site", { precision: 8, scale: 2 }), // meters
  isWithinGeofence: boolean("is_within_geofence").notNull(),
  verificationStatus: text("verification_status", { enum: ["approved", "flagged", "rejected"] }).default("approved").notNull(),
  flagReason: text("flag_reason"), // reason if flagged or rejected
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  metadata: jsonb("metadata").default(sql`'{}'`), // additional location data
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Location permission tracking
export const locationPermissions = pgTable("location_permissions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  permissionStatus: text("permission_status", {
    enum: ["granted", "denied", "prompt", "not_requested"]
  }).default("not_requested").notNull(),
  permissionType: text("permission_type", {
    enum: ["precise", "approximate", "denied"]
  }),
  browserInfo: text("browser_info"), // user agent info
  deviceInfo: text("device_info"), // device type if available
  requestedAt: timestamp("requested_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  locationSource: text("location_source", { enum: ["gps", "network", "manual"] }).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).default(sql`NOW()`).notNull(),
  batteryLevel: integer("battery_level"), // percentage if available
  networkType: text("network_type"), // wifi, cellular, etc.
  isBackground: boolean("is_background").default(false), // if location was captured in background
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Facility Management table for schools to manage their clinical facilities
export const facilityManagement = pgTable("facility_management", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  facilityName: text("facility_name").notNull(),
  facilityType: text("facility_type", {
    enum: ["hospital", "clinic", "nursing_home", "outpatient", "emergency", "pharmacy", "laboratory", "other"]
  }).notNull(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  geofenceRadius: integer("geofence_radius").default(100).notNull(),
  strictGeofence: boolean("strict_geofence").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  isCustom: boolean("is_custom").default(false).notNull(),
  osmId: text("osm_id"),
  priority: integer("priority").default(0).notNull(),
  contactInfo: jsonb("contact_info").default({}).notNull(),
  operatingHours: jsonb("operating_hours").default({}).notNull(),
  specialties: text("specialties").array().default([]).notNull(),
  notes: text("notes"),
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "set null" }),
  clinicalSiteId: text("clinical_site_id")
    .references(() => clinicalSites.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Notifications table - Core notification system
export const notifications = pgTable("notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type", {
    enum: ["info", "warning", "error", "success", "reminder", "assignment", "evaluation", "system"]
  }).notNull(),
  priority: text("priority", {
    enum: ["low", "medium", "high", "urgent"]
  }).default("medium").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  data: jsonb("data").default({}).notNull(),
  actionUrl: text("action_url"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Documents table - Document management system
export const documents = pgTable("documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  uploadedBy: text("uploaded_by")
    .references(() => users.id, { onDelete: "set null" }),
  documentType: text("document_type", {
    enum: ["assignment", "evaluation", "certificate", "transcript", "medical", "legal", "other"]
  }).notNull(),
  relatedEntityType: text("related_entity_type", {
    enum: ["user", "rotation", "competency", "assessment", "clinical_site", "program"]
  }),
  relatedEntityId: text("related_entity_id"),
  isPublic: boolean("is_public").default(false).notNull(),
  isArchived: boolean("is_archived").default(false).notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  tags: text("tags").array().default([]).notNull(),
  version: integer("version").default(1).notNull(),
  checksum: text("checksum"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Students table - Student-specific data (extends users table)
export const students = pgTable("students", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  studentNumber: text("student_number").notNull().unique(),
  programId: text("program_id")
    .references(() => programs.id, { onDelete: "set null" }),
  cohort: text("cohort"),
  yearLevel: integer("year_level"),
  semester: integer("semester"),
  academicAdvisorId: text("academic_advisor_id")
    .references(() => users.id, { onDelete: "set null" }),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  emergencyContactRelation: text("emergency_contact_relation"),
  medicalConditions: text("medical_conditions"),
  allergies: text("allergies"),
  medications: text("medications"),
  immunizationStatus: jsonb("immunization_status").default({}).notNull(),
  backgroundCheckStatus: text("background_check_status", {
    enum: ["pending", "approved", "rejected", "expired"]
  }),
  backgroundCheckDate: timestamp("background_check_date", { withTimezone: true }),
  drugScreenStatus: text("drug_screen_status", {
    enum: ["pending", "passed", "failed", "expired"]
  }),
  drugScreenDate: timestamp("drug_screen_date", { withTimezone: true }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Clinical Preceptors table - Clinical preceptor management
export const clinicalPreceptors = pgTable("clinical_preceptors", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  licenseNumber: text("license_number").notNull(),
  licenseType: text("license_type").notNull(),
  licenseState: text("license_state").notNull(),
  licenseExpirationDate: timestamp("license_expiration_date", { withTimezone: true }).notNull(),
  specialty: text("specialty").notNull(),
  yearsOfExperience: integer("years_of_experience"),
  clinicalSiteId: text("clinical_site_id")
    .references(() => clinicalSites.id, { onDelete: "set null" }),
  department: text("department"),
  title: text("title"),
  maxStudents: integer("max_students").default(4).notNull(),
  currentStudentCount: integer("current_student_count").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  availabilitySchedule: jsonb("availability_schedule").default({}).notNull(),
  teachingPreferences: jsonb("teaching_preferences").default({}).notNull(),
  evaluationCriteria: jsonb("evaluation_criteria").default({}).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Clinical Supervisors table - Clinical supervisor management
export const clinicalSupervisors = pgTable("clinical_supervisors", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  licenseNumber: text("license_number").notNull(),
  licenseType: text("license_type").notNull(),
  licenseState: text("license_state").notNull(),
  licenseExpirationDate: timestamp("license_expiration_date", { withTimezone: true }).notNull(),
  specialty: text("specialty").notNull(),
  yearsOfExperience: integer("years_of_experience"),
  clinicalSiteId: text("clinical_site_id")
    .references(() => clinicalSites.id, { onDelete: "set null" }),
  department: text("department"),
  title: text("title"),
  supervisoryRole: text("supervisory_role", {
    enum: ["direct", "indirect", "collaborative", "consultative"]
  }).notNull(),
  maxSupervisees: integer("max_supervisees").default(10).notNull(),
  currentSuperviseeCount: integer("current_supervisee_count").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  supervisionSchedule: jsonb("supervision_schedule").default({}).notNull(),
  supervisionStyle: jsonb("supervision_style").default({}).notNull(),
  qualifications: jsonb("qualifications").default({}).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Query Performance Log table - Performance monitoring
export const queryPerformanceLog = pgTable("query_performance_log", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  queryHash: text("query_hash").notNull(),
  queryText: text("query_text").notNull(),
  executionTime: decimal("execution_time", { precision: 10, scale: 3 }).notNull(),
  rowsAffected: integer("rows_affected"),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "set null" }),
  endpoint: text("endpoint"),
  method: text("method"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  sessionId: text("session_id"),
  errorMessage: text("error_message"),
  stackTrace: text("stack_trace"),
  queryPlan: jsonb("query_plan"),
  cacheHit: boolean("cache_hit").default(false).notNull(),
  indexesUsed: text("indexes_used").array().default([]).notNull(),
  tablesAccessed: text("tables_accessed").array().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Export types
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
export type Verification = typeof verifications.$inferSelect
export type NewVerification = typeof verifications.$inferInsert
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
export type School = typeof schools.$inferSelect
export type NewSchool = typeof schools.$inferInsert
export type Program = typeof programs.$inferSelect
export type NewProgram = typeof programs.$inferInsert
export type ClinicalSite = typeof clinicalSites.$inferSelect
export type NewClinicalSite = typeof clinicalSites.$inferInsert
export type ProgramClinicalSite = typeof programClinicalSites.$inferSelect
export type NewProgramClinicalSite = typeof programClinicalSites.$inferInsert
export type Rotation = typeof rotations.$inferSelect
export type NewRotation = typeof rotations.$inferInsert
export type TimeRecord = typeof timeRecords.$inferSelect
export type NewTimeRecord = typeof timeRecords.$inferInsert
export type Competency = typeof competencies.$inferSelect
export type NewCompetency = typeof competencies.$inferInsert
export type Assessment = typeof assessments.$inferSelect
export type NewAssessment = typeof assessments.$inferInsert
export type Evaluation = typeof evaluations.$inferSelect
export type NewEvaluation = typeof evaluations.$inferInsert
export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
export type CompetencyTemplate = typeof competencyTemplates.$inferSelect
export type NewCompetencyTemplate = typeof competencyTemplates.$inferInsert
export type RubricCriteria = typeof rubricCriteria.$inferSelect
export type NewRubricCriteria = typeof rubricCriteria.$inferInsert
export type CompetencyDeployment = typeof competencyDeployments.$inferSelect
export type NewCompetencyDeployment = typeof competencyDeployments.$inferInsert
export type CompetencyAssignment = typeof competencyAssignments.$inferSelect
export type NewCompetencyAssignment = typeof competencyAssignments.$inferInsert
export type CompetencySubmission = typeof competencySubmissions.$inferSelect
export type NewCompetencySubmission = typeof competencySubmissions.$inferInsert
export type CompetencyVersion = typeof competencyVersions.$inferSelect
export type NewCompetencyVersion = typeof competencyVersions.$inferInsert
export type ImportExportLog = typeof importExportLogs.$inferSelect
export type NewImportExportLog = typeof importExportLogs.$inferInsert
export type NotificationTemplate = typeof notificationTemplates.$inferSelect
export type NewNotificationTemplate = typeof notificationTemplates.$inferInsert
export type TimecardCorrection = typeof timecardCorrections.$inferSelect
export type NewTimecardCorrection = typeof timecardCorrections.$inferInsert
export type ProgressSnapshot = typeof progressSnapshots.$inferSelect
export type NewProgressSnapshot = typeof progressSnapshots.$inferInsert
export type LearningAnalytics = typeof learningAnalytics.$inferSelect
export type NewLearningAnalytics = typeof learningAnalytics.$inferInsert
export type NotificationQueue = typeof notificationQueue.$inferSelect
export type NewNotificationQueue = typeof notificationQueue.$inferInsert
export type ReportCache = typeof reportCache.$inferSelect
export type NewReportCache = typeof reportCache.$inferInsert
export type CompetencyRubric = typeof competencyRubrics.$inferSelect
export type NewCompetencyRubric = typeof competencyRubrics.$inferInsert
export type SiteAssignment = typeof siteAssignments.$inferSelect
export type NewSiteAssignment = typeof siteAssignments.$inferInsert
export type ScheduledReport = typeof scheduledReports.$inferSelect
export type NewScheduledReport = typeof scheduledReports.$inferInsert
export type OnboardingAnalytics = typeof onboardingAnalytics.$inferSelect
export type NewOnboardingAnalytics = typeof onboardingAnalytics.$inferInsert
export type OnboardingSession = typeof onboardingSessions.$inferSelect
export type NewOnboardingSession = typeof onboardingSessions.$inferInsert
export type FacilityManagement = typeof facilityManagement.$inferSelect
export type NewFacilityManagement = typeof facilityManagement.$inferInsert
export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
export type Student = typeof students.$inferSelect
export type NewStudent = typeof students.$inferInsert
export type ClinicalPreceptor = typeof clinicalPreceptors.$inferSelect
export type NewClinicalPreceptor = typeof clinicalPreceptors.$inferInsert
export type ClinicalSupervisor = typeof clinicalSupervisors.$inferSelect
export type NewClinicalSupervisor = typeof clinicalSupervisors.$inferInsert
export type QueryPerformanceLog = typeof queryPerformanceLog.$inferSelect
export type NewQueryPerformanceLog = typeof queryPerformanceLog.$inferInsert
export type RotationTemplate = typeof rotationTemplates.$inferSelect
export type NewRotationTemplate = typeof rotationTemplates.$inferInsert
export type CohortRotationAssignment = typeof cohortRotationAssignments.$inferSelect
export type NewCohortRotationAssignment = typeof cohortRotationAssignments.$inferInsert
export type Cohort = typeof cohorts.$inferSelect
export type NewCohort = typeof cohorts.$inferInsert

// Materialized Views (defined as tables for querying)
export const mvUserProgressSummary = pgTable("mv_user_progress_summary", {
  userId: text("user_id"),
  programId: text("program_id"),
  rotationId: text("rotation_id"),
  totalAssignments: integer("total_assignments"),
  completedAssignments: integer("completed_assignments"),
  pendingAssignments: integer("pending_assignments"),
  overdueAssignments: integer("overdue_assignments"),
  completionRate: decimal("completion_rate", { precision: 5, scale: 2 }),
  averageScore: decimal("average_score", { precision: 5, scale: 2 }),
  lastUpdated: timestamp("last_updated"),
})

export const mvSchoolStatistics = pgTable("mv_school_statistics", {

  schoolId: text("school_id"),
  totalStudents: integer("total_students"),
  activeStudents: integer("active_students"),
  totalRotations: integer("total_rotations"),
  activeRotations: integer("active_rotations"),
  completionRate: decimal("completion_rate", { precision: 5, scale: 2 }),
  lastUpdated: timestamp("last_updated"),
})

export const mvDailyActivitySummary = pgTable("mv_daily_activity_summary", {
  activityDate: timestamp("activity_date", { mode: "date" }),
  schoolId: text("school_id"),
  programId: text("program_id"),
  activeUsers: integer("active_users"),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }),
  submissions: integer("submissions"),
  evaluations: integer("evaluations"),
})

export const mvCompetencyAnalytics = pgTable("mv_competency_analytics", {
  competencyId: text("competency_id"),
  competencyName: text("competency_name"),
  totalAssignments: integer("total_assignments"),
  completedAssignments: integer("completed_assignments"),
  averageScore: decimal("average_score", { precision: 5, scale: 2 }),
  passRate: decimal("pass_rate", { precision: 5, scale: 2 }),
  completionRate: decimal("completion_rate", { precision: 5, scale: 2 }),
  schoolId: text("school_id"),
  programId: text("program_id"),
  lastUpdated: timestamp("last_updated"),
})

export const meetings = pgTable("meetings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  organizerId: text("organizer_id").references(() => users.id).notNull(),
  studentId: text("student_id").references(() => users.id),
  type: text("type", { enum: ["VIRTUAL", "IN_PERSON"] }).default("VIRTUAL").notNull(),
  location: text("location"),
  meetingLink: text("meeting_link"),
  status: text("status", { enum: ["SCHEDULED", "COMPLETED", "CANCELLED"] }).default("SCHEDULED").notNull(),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
})

export type Meeting = typeof meetings.$inferSelect
export type NewMeeting = typeof meetings.$inferInsert

export const locationAccuracyLogs = pgTable("location_accuracy_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").references(() => users.id),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  accuracy: text("accuracy").notNull(),
  locationSource: text("location_source").notNull(),
  createdAt: timestamp("created_at").default(sql`NOW()`).notNull(),
})

export type LocationAccuracyLog = typeof locationAccuracyLogs.$inferSelect
export type NewLocationAccuracyLog = typeof locationAccuracyLogs.$inferInsert

// Rate limiting table for Neon-based rate limiting
export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text("key").notNull(), // userId or IP address
  endpoint: text("endpoint").notNull(), // API endpoint pattern (e.g., "clock", "admin", "invitations")
  count: integer("count").default(1).notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$defaultFn(() => new Date()).notNull(),
}, (table) => ({
  keyEndpointIdx: uniqueIndex("rate_limits_key_endpoint_idx").on(table.key, table.endpoint),
  windowEndIdx: index("rate_limits_window_end_idx").on(table.windowEnd),
}))

export type RateLimit = typeof rateLimits.$inferSelect
export type NewRateLimit = typeof rateLimits.$inferInsert

export const cacheEntries = pgTable("cache_entries", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  tags: text("tags").array(),
}, (table) => ({
  expiresAtIdx: index("cache_entries_expires_at_idx").on(table.expiresAt),
}))

export type CacheEntry = typeof cacheEntries.$inferSelect
export type NewCacheEntry = typeof cacheEntries.$inferInsert

// Quality Assurance Tables
export const qualityReviews = pgTable("quality_reviews", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  reviewerId: text("reviewer_id")
    .references(() => users.id, { onDelete: "set null" })
    .notNull(),
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type", {
    enum: ["Assessment Quality", "Supervision Quality", "Process Audit"]
  }).notNull(),
  status: text("status", {
    enum: ["completed", "in_progress", "pending"]
  }).default("pending").notNull(),
  priority: text("priority", {
    enum: ["high", "medium", "low"]
  }).default("medium").notNull(),
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }),
  findings: jsonb("findings").default([]).notNull(), // Array of Finding objects
  recommendations: jsonb("recommendations").default([]).notNull(), // Array of strings
  followUpRequired: boolean("follow_up_required").default(false).notNull(),
  followUpDate: timestamp("follow_up_date", { withTimezone: true }),
  reviewDate: timestamp("review_date", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  schoolIdx: index("quality_reviews_school_idx").on(table.schoolId),
  reviewerIdx: index("quality_reviews_reviewer_idx").on(table.reviewerId),
  statusIdx: index("quality_reviews_status_idx").on(table.status),
}))

export type QualityReview = typeof qualityReviews.$inferSelect
export type NewQualityReview = typeof qualityReviews.$inferInsert


// Compliance & Requirement Center Tables

export const complianceRequirements = pgTable("compliance_requirements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  schoolId: text("school_id")
    .references(() => schools.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type", { enum: ["DOCUMENT", "DATE", "BOOLEAN"] }).notNull(),
  frequency: text("frequency", { enum: ["ONCE", "ANNUAL", "BIENNIAL"] }).default("ONCE").notNull(),
  isRequired: boolean("is_required").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
}, (table) => ({
  schoolIdx: index("compliance_req_school_idx").on(table.schoolId),
}))

export const programComplianceRequirements = pgTable("program_compliance_requirements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  programId: text("program_id")
    .references(() => programs.id, { onDelete: "cascade" })
    .notNull(),
  requirementId: text("requirement_id")
    .references(() => complianceRequirements.id, { onDelete: "cascade" })
    .notNull(),
  dueDateOffsetDays: integer("due_date_offset_days"), // Days from enrollment
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
}, (table) => ({
  programReqIdx: uniqueIndex("program_compliance_req_idx").on(table.programId, table.requirementId),
}))

export const complianceSubmissions = pgTable("compliance_submissions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: text("student_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  requirementId: text("requirement_id")
    .references(() => complianceRequirements.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status", { enum: ["PENDING", "APPROVED", "REJECTED", "EXPIRED"] })
    .default("PENDING")
    .notNull(),
  submissionData: jsonb("submission_data"), // Stores dates or other simple values
  documentId: text("document_id")
    .references(() => documents.id, { onDelete: "set null" }),
  notes: text("notes"),
  reviewedBy: text("reviewed_by")
    .references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
}, (table) => ({
  studentReqIdx: index("compliance_sub_student_req_idx").on(table.studentId, table.requirementId),
  statusIdx: index("compliance_sub_status_idx").on(table.status),
}))

export type ComplianceRequirement = typeof complianceRequirements.$inferSelect
export type NewComplianceRequirement = typeof complianceRequirements.$inferInsert
export type ProgramComplianceRequirement = typeof programComplianceRequirements.$inferSelect
export type NewProgramComplianceRequirement = typeof programComplianceRequirements.$inferInsert
export type ComplianceSubmission = typeof complianceSubmissions.$inferSelect
export type NewComplianceSubmission = typeof complianceSubmissions.$inferInsert

// Site & Preceptor Evaluations

export const siteEvaluations = pgTable("site_evaluations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  studentId: text("student_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  rotationId: text("rotation_id")
    .references(() => rotations.id, { onDelete: "cascade" })
    .notNull(),
  clinicalSiteId: text("clinical_site_id")
    .references(() => clinicalSites.id, { onDelete: "cascade" })
    .notNull(),
  preceptorId: text("preceptor_id")
    .references(() => clinicalPreceptors.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(), // Overall rating 1-5
  feedback: text("feedback"),
  learningOpportunitiesRating: integer("learning_opportunities_rating"),
  preceptorSupportRating: integer("preceptor_support_rating"),
  facilityQualityRating: integer("facility_quality_rating"),
  recommendToOthers: boolean("recommend_to_others").default(true).notNull(),
  isAnonymous: boolean("is_anonymous").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
}, (table) => ({
  studentIdx: index("site_eval_student_idx").on(table.studentId),
  siteIdx: index("site_eval_site_idx").on(table.clinicalSiteId),
  rotationIdx: uniqueIndex("site_eval_rotation_idx").on(table.rotationId), // One evaluation per rotation
}))

export type SiteEvaluation = typeof siteEvaluations.$inferSelect
export type NewSiteEvaluation = typeof siteEvaluations.$inferInsert
