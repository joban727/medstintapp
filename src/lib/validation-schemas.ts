import { z } from "zod"

export const CreateProgramRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  duration: z.number().min(1),
  schoolId: z.string().min(1),
  requirements: z.array(z.string()).optional(),
})

export const UpdateProgramRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  duration: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
  requirements: z.array(z.string()).optional(),
})

export const CreateRotationRequestSchema = z.object({
  studentId: z.string().min(1),
  clinicalSiteId: z.string().min(1),
  preceptorId: z.string().min(1),
  supervisorId: z.string().optional(),
  specialty: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  requiredHours: z.number().min(1),
  objectives: z.array(z.string()).optional(),
})

export const UpdateRotationRequestSchema = z.object({
  clinicalSiteId: z.string().optional(),
  preceptorId: z.string().optional(),
  supervisorId: z.string().optional(),
  specialty: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  requiredHours: z.number().min(1).optional(),
  status: z.enum(["SCHEDULED", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  objectives: z.array(z.string()).optional(),
})

export const CreateSiteAssignmentRequestSchema = z.object({
  studentId: z.string().min(1),
  clinicalSiteId: z.string().min(1),
  rotationId: z.string().optional(),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  notes: z.string().optional(),
})

export const BulkAssignStudentsRequestSchema = z.object({
  clinicalSiteId: z.string().min(1),
  studentIds: z.array(z.string()).min(1),
  rotationId: z.string().optional(),
  startDate: z.string().transform((str) => new Date(str)),
  endDate: z
    .string()
    .transform((str) => new Date(str))
    .optional(),
  notes: z.string().optional(),
})
