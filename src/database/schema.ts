import { sql } from "drizzle-orm"
import { boolean, decimal, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core"

// User role type
export type UserRole =
  | "SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "CLINICAL_PRECEPTOR"
  | "CLINICAL_SUPERVISOR"
  | "STUDENT"

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
    enum: ["SUPER_ADMIN", "SCHOOL_ADMIN", "CLINICAL_PRECEPTOR", "CLINICAL_SUPERVISOR", "STUDENT"],
  })
    .default("STUDENT")
    .notNull(),
  schoolId: text("school_id"),
  department: text("department"),
  phone: text("phone"),
  address: text("address"),
  isActive: boolean("is_active").default(true).notNull(),
  studentId: text("student_id"),
  programId: text("program_id"),
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
})

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
  accreditation: text("accreditation").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  adminId: text("admin_id").references(() => users.id),
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
})

export const clinicalSites = pgTable("clinical_sites", {
  id: text("id").primaryKey(),
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

export const rotations = pgTable("rotations", {
  id: text("id").primaryKey(),
  studentId: text("student_id")
    .references(() => users.id)
    .notNull(),
  clinicalSiteId: text("clinical_site_id")
    .references(() => clinicalSites.id)
    .notNull(),
  preceptorId: text("preceptor_id")
    .references(() => users.id)
    .notNull(),
  supervisorId: text("supervisor_id").references(() => users.id),
  specialty: text("specialty").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  requiredHours: integer("required_hours").notNull(),
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
  date: timestamp("date", { mode: "date" }).notNull(),
  clockIn: timestamp("clock_in", { withTimezone: true }),
  clockOut: timestamp("clock_out", { withTimezone: true }),
  totalHours: text("total_hours"),
  activities: text("activities"), // JSON array of activities
  notes: text("notes"),
  // IP and User Agent tracking
  clockInIpAddress: text("clock_in_ip_address"),
  clockInUserAgent: text("clock_in_user_agent"),
  clockOutIpAddress: text("clock_out_ip_address"),
  clockOutUserAgent: text("clock_out_user_agent"),
  // Location tracking fields
  clockInLatitude: decimal("clock_in_latitude", { precision: 10, scale: 8 }),
  clockInLongitude: decimal("clock_in_longitude", { precision: 11, scale: 8 }),
  clockOutLatitude: decimal("clock_out_latitude", { precision: 10, scale: 8 }),
  clockOutLongitude: decimal("clock_out_longitude", { precision: 11, scale: 8 }),
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
})

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
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => new Date())
    .notNull(),
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
  startDate: timestamp("start_date").notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Location accuracy tracking and analytics
export const locationAccuracyLogs = pgTable("location_accuracy_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  sessionId: text("session_id"), // browser session or app session
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  accuracy: decimal("accuracy", { precision: 8, scale: 2 }), // meters
  altitude: decimal("altitude", { precision: 8, scale: 2 }), // meters above sea level
  altitudeAccuracy: decimal("altitude_accuracy", { precision: 8, scale: 2 }), // meters
  heading: decimal("heading", { precision: 5, scale: 2 }), // degrees
  speed: decimal("speed", { precision: 8, scale: 2 }), // meters per second
  locationSource: text("location_source", { enum: ["gps", "network", "manual"] }).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true }).default(sql`NOW()`).notNull(),
  batteryLevel: integer("battery_level"), // percentage if available
  networkType: text("network_type"), // wifi, cellular, etc.
  isBackground: boolean("is_background").default(false), // if location was captured in background
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
})

// Facility Management table for schools to manage their clinical facilities
export const facilityManagement = pgTable("facility_management", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  facilityName: text("facility_name", { length: 200 }).notNull(),
  facilityType: text("facility_type", {
    enum: ["hospital", "clinic", "nursing_home", "outpatient", "emergency", "pharmacy", "laboratory", "other"]
  }).notNull(),
  address: text("address", { length: 500 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  geofenceRadius: integer("geofence_radius").default(100).notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).default(sql`NOW()`).notNull(),
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
