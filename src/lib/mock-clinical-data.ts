/*
  Mock clinical data and validation utilities for school administration workflows.
  - Normalized models for students, programs, clinical sites, rotations, slots, clock records
  - Comprehensive sample data sets
  - Eligibility validation, rotation verification, site rule enforcement
  - Clock-in/out functions with accurate hour tracking and reporting
*/

// ---------- Types ----------
export type Program = {
  id: string
  name: string
  schoolId: string
  durationMonths: number
  requirements: string[]
}

export type StudentProfile = {
  id: string // maps to users.id
  studentId: string // human-friendly student code
  name: string
  email: string
  programId: string
  enrollmentDate: string
  expectedGraduation: string
  status: "ACTIVE" | "PROBATION" | "SUSPENDED" | "GRADUATED" | "WITHDRAWN"
  assignedRotationIds: string[]
  completedHours: number
}

export type SiteRule = {
  maxShiftHours?: number
  allowOvernight?: boolean
  graceMinutes?: number // allowed buffer around scheduled times
  requireVaccinations?: string[]
  requireBackgroundCheck?: boolean
  geofenceRequired?: boolean
}

export type OperatingHours = {
  // ISO weekday number mapping: 0=Sun ... 6=Sat
  [weekday: number]: { open: string; close: string } // HH:mm (24h)
}

export type RotationSlot = {
  id: string
  siteId: string
  dayOfWeek: number // 0-6
  startTime: string // HH:mm
  endTime: string // HH:mm
  maxStudents: number
  specialty?: string
}

export type ClinicalSite = {
  id: string
  name: string
  address: string
  type: "HOSPITAL" | "CLINIC" | "NURSING_HOME" | "OUTPATIENT" | "OTHER"
  capacity: number
  specialties: string[]
  requirements: string[]
  location?: { lat: number; lon: number; radiusMeters: number }
  rules: SiteRule
  operatingHours: OperatingHours
  slots: RotationSlot[]
}

export type Rotation = {
  id: string
  studentId: string
  siteId: string
  specialty: string
  startDate: string // ISO
  endDate: string // ISO
  requiredHours: number
  schedule: { days: number[]; startTime: string; endTime: string } // HH:mm
  preceptorId: string
  supervisorId?: string
  status: "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED"
}

export type ClockRecord = {
  id: string
  studentId: string
  rotationId: string
  siteId: string
  date: string // YYYY-MM-DD
  clockIn?: string // ISO
  clockOut?: string // ISO
  totalHours?: number
  notes?: string
  metadata?: {
    ipAddress?: string
    userAgent?: string
    lat?: number
    lon?: number
    withinGeofence?: boolean
  }
}

// ---------- Helpers ----------
const uid = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2)}${Date.now()}`

const toMinutes = (timeHHMM: string) => {
  const [h, m] = timeHHMM.split(":").map((x) => parseInt(x, 10))
  return h * 60 + m
}

const minutesSinceMidnight = (d: Date) => d.getHours() * 60 + d.getMinutes()

const toISODate = (d: Date) => d.toISOString().slice(0, 10)

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// ---------- Mock Data ----------
export const programs: Program[] = [
  {
    id: "prog_rad_tech",
    name: "Radiologic Technology",
    schoolId: "school_medstint",
    durationMonths: 24,
    requirements: ["HepB Vaccination", "Basic Life Support", "Background Check"],
  },
  {
    id: "prog_mri",
    name: "Magnetic Resonance Imaging",
    schoolId: "school_medstint",
    durationMonths: 18,
    requirements: ["Basic Life Support", "Background Check", "MRI Safety"],
  },
]

export const clinicalSites: ClinicalSite[] = [
  {
    id: "site_city_hospital",
    name: "City Hospital",
    address: "123 Health Ave, Metropolis",
    type: "HOSPITAL",
    capacity: 60,
    specialties: ["General Radiology", "MRI", "CT Scan"],
    requirements: ["HepB Vaccination", "Basic Life Support", "Background Check"],
    location: { lat: 40.7128, lon: -74.006, radiusMeters: 120 },
    rules: { maxShiftHours: 12, allowOvernight: true, graceMinutes: 15, geofenceRequired: true },
    operatingHours: {
      0: { open: "00:00", close: "23:59" },
      1: { open: "00:00", close: "23:59" },
      2: { open: "00:00", close: "23:59" },
      3: { open: "00:00", close: "23:59" },
      4: { open: "00:00", close: "23:59" },
      5: { open: "00:00", close: "23:59" },
      6: { open: "00:00", close: "23:59" },
    },
    slots: [
      {
        id: uid("slot"),
        siteId: "site_city_hospital",
        dayOfWeek: 1,
        startTime: "07:00",
        endTime: "19:00",
        maxStudents: 12,
        specialty: "General Radiology",
      },
      {
        id: uid("slot"),
        siteId: "site_city_hospital",
        dayOfWeek: 3,
        startTime: "07:00",
        endTime: "19:00",
        maxStudents: 12,
        specialty: "MRI",
      },
    ],
  },
  {
    id: "site_sunrise_clinic",
    name: "Sunrise Community Clinic",
    address: "45 Wellness Rd, Lakeside",
    type: "CLINIC",
    capacity: 25,
    specialties: ["Ultrasound", "Mammography"],
    requirements: ["Basic Life Support", "Background Check"],
    location: { lat: 34.0522, lon: -118.2437, radiusMeters: 100 },
    rules: { maxShiftHours: 8, allowOvernight: false, graceMinutes: 10, geofenceRequired: true },
    operatingHours: {
      1: { open: "08:00", close: "18:00" },
      2: { open: "08:00", close: "18:00" },
      3: { open: "08:00", close: "18:00" },
      4: { open: "08:00", close: "18:00" },
      5: { open: "08:00", close: "18:00" },
    },
    slots: [
      {
        id: uid("slot"),
        siteId: "site_sunrise_clinic",
        dayOfWeek: 2,
        startTime: "09:00",
        endTime: "17:00",
        maxStudents: 6,
        specialty: "Mammography",
      },
      {
        id: uid("slot"),
        siteId: "site_sunrise_clinic",
        dayOfWeek: 4,
        startTime: "09:00",
        endTime: "17:00",
        maxStudents: 6,
        specialty: "Ultrasound",
      },
    ],
  },
  {
    id: "site_oak_nursing",
    name: "Oak Grove Nursing Home",
    address: "9 Care Ln, Greenfield",
    type: "NURSING_HOME",
    capacity: 35,
    specialties: ["Nuclear Medicine", "Radiation Therapy"],
    requirements: ["HepB Vaccination", "Background Check"],
    location: { lat: 41.8781, lon: -87.6298, radiusMeters: 150 },
    rules: { maxShiftHours: 10, allowOvernight: false, graceMinutes: 20, geofenceRequired: false },
    operatingHours: {
      1: { open: "06:00", close: "20:00" },
      2: { open: "06:00", close: "20:00" },
      3: { open: "06:00", close: "20:00" },
      4: { open: "06:00", close: "20:00" },
      5: { open: "06:00", close: "20:00" },
      6: { open: "06:00", close: "14:00" },
    },
    slots: [
      {
        id: uid("slot"),
        siteId: "site_oak_nursing",
        dayOfWeek: 1,
        startTime: "07:00",
        endTime: "15:00",
        maxStudents: 8,
        specialty: "Nuclear Medicine",
      },
      {
        id: uid("slot"),
        siteId: "site_oak_nursing",
        dayOfWeek: 5,
        startTime: "07:00",
        endTime: "15:00",
        maxStudents: 8,
        specialty: "Radiation Therapy",
      },
    ],
  },
]

export const students: StudentProfile[] = [
  {
    id: "user_s01",
    studentId: "S-1001",
    name: "Alex Morgan",
    email: "alex.morgan@example.edu",
    programId: "prog_rad_tech",
    enrollmentDate: "2024-08-20",
    expectedGraduation: "2028-05-20",
    status: "ACTIVE",
    assignedRotationIds: [],
    completedHours: 0,
  },
  {
    id: "user_s02",
    studentId: "S-1002",
    name: "Brianna Chen",
    email: "brianna.chen@example.edu",
    programId: "prog_rad_tech",
    enrollmentDate: "2024-08-20",
    expectedGraduation: "2028-05-20",
    status: "ACTIVE",
    assignedRotationIds: [],
    completedHours: 0,
  },
  {
    id: "user_s03",
    studentId: "S-1003",
    name: "Carlos Diaz",
    email: "carlos.diaz@example.edu",
    programId: "prog_mri",
    enrollmentDate: "2024-08-20",
    expectedGraduation: "2026-05-20",
    status: "ACTIVE",
    assignedRotationIds: [],
    completedHours: 0,
  },
  {
    id: "user_s04",
    studentId: "S-1004",
    name: "Dana Patel",
    email: "dana.patel@example.edu",
    programId: "prog_mri",
    enrollmentDate: "2024-08-20",
    expectedGraduation: "2026-05-20",
    status: "ACTIVE",
    assignedRotationIds: [],
    completedHours: 0,
  },
]

export const rotations: Rotation[] = [
  {
    id: "rot_emergency_alex",
    studentId: "user_s01",
    siteId: "site_city_hospital",
    specialty: "General Radiology",
    startDate: "2025-01-05",
    endDate: "2025-03-30",
    requiredHours: 160,
    schedule: { days: [1, 3], startTime: "07:00", endTime: "19:00" },
    preceptorId: "user_p01",
    status: "ACTIVE",
  },
  {
    id: "rot_icu_brianna",
    studentId: "user_s02",
    siteId: "site_city_hospital",
    specialty: "MRI",
    startDate: "2025-02-01",
    endDate: "2025-04-15",
    requiredHours: 140,
    schedule: { days: [3], startTime: "07:00", endTime: "19:00" },
    preceptorId: "user_p01",
    supervisorId: "user_sup01",
    status: "SCHEDULED",
  },
  {
    id: "rot_outpatient_carlos",
    studentId: "user_s03",
    siteId: "site_sunrise_clinic",
    specialty: "Mammography",
    startDate: "2025-01-20",
    endDate: "2025-03-10",
    requiredHours: 120,
    schedule: { days: [2, 4], startTime: "09:00", endTime: "17:00" },
    preceptorId: "user_p02",
    status: "ACTIVE",
  },
  {
    id: "rot_geriatrics_dana",
    studentId: "user_s04",
    siteId: "site_oak_nursing",
    specialty: "Nuclear Medicine",
    startDate: "2025-02-05",
    endDate: "2025-03-25",
    requiredHours: 100,
    schedule: { days: [1, 5], startTime: "07:00", endTime: "15:00" },
    preceptorId: "user_p03",
    status: "SCHEDULED",
  },
]

// Assign rotation IDs on student profiles
for (const r of rotations) {
  const s = students.find((x) => x.id === r.studentId)
  if (s && !s.assignedRotationIds.includes(r.id)) s.assignedRotationIds.push(r.id)
}

// Clock records are mutable in-memory for simulation purposes
export const clockRecords: ClockRecord[] = []

// ---------- Validation ----------
export const findStudent = (studentId: string) => students.find((s) => s.id === studentId)
export const findSite = (siteId: string) => clinicalSites.find((c) => c.id === siteId)
export const findRotation = (rotationId: string) => rotations.find((r) => r.id === rotationId)

export const validateStudentEligibilityForSite = (
  studentId: string,
  siteId: string
): {
  eligible: boolean
  reasons: string[]
} => {
  const student = findStudent(studentId)
  const site = findSite(siteId)
  if (!student || !site) return { eligible: false, reasons: ["Student or site not found"] }
  const program = programs.find((p) => p.id === student.programId)
  const reasons: string[] = []
  // Program-level requirements must be subset of site requirements
  for (const req of program?.requirements ?? []) {
    if (!site.requirements.includes(req)) reasons.push(`Site missing program requirement: ${req}`)
  }
  // Capacity check (rough; counts concurrent active rotations at site)
  const activeCount = rotations.filter(
    (r) => r.siteId === site.id && r.status !== "CANCELLED"
  ).length
  if (activeCount >= site.capacity) reasons.push("Site capacity reached")
  return { eligible: reasons.length === 0, reasons }
}

export const getRotationForDate = (
  studentId: string,
  siteId: string,
  when: Date
): Rotation | undefined => {
  return rotations.find((r) => {
    if (r.studentId !== studentId || r.siteId !== siteId) return false
    const start = new Date(r.startDate)
    const end = new Date(r.endDate)
    return when >= start && when <= end
  })
}

export const isWithinOperatingHours = (site: ClinicalSite, dt: Date) => {
  const day = dt.getDay()
  const oh = site.operatingHours[day]
  if (!oh) return false
  const now = minutesSinceMidnight(dt)
  const open = toMinutes(oh.open)
  const close = toMinutes(oh.close)
  return now >= open && now <= close
}

export const isWithinSlotWindow = (site: ClinicalSite, rotation: Rotation, dt: Date) => {
  const day = dt.getDay()
  const slot = site.slots.find(
    (s) => s.dayOfWeek === day && (!s.specialty || s.specialty === rotation.specialty)
  )
  if (!slot) return false
  const now = minutesSinceMidnight(dt)
  const start = toMinutes(slot.startTime)
  const end = toMinutes(slot.endTime)
  const grace = site.rules.graceMinutes ?? 0
  return now >= start - grace && now <= end + grace
}

export const validateGeofence = (site: ClinicalSite, lat?: number, lon?: number) => {
  if (!site.rules.geofenceRequired) return { ok: true, distanceMeters: undefined }
  if (!site.location || lat == null || lon == null) return { ok: false, distanceMeters: undefined }
  const d = haversineMeters(site.location.lat, site.location.lon, lat, lon)
  return { ok: d <= site.location.radiusMeters, distanceMeters: d }
}

// ---------- Workflow Helpers ----------
export const listAvailableSitesForStudent = (studentId: string, onDate?: Date) => {
  const date = onDate ?? new Date()
  return clinicalSites
    .filter((site) => validateStudentEligibilityForSite(studentId, site.id).eligible)
    .filter((site) => isWithinOperatingHours(site, date))
}

export const verifyRotationAssignment = (studentId: string, siteId: string, onDate: Date) => {
  const rot = getRotationForDate(studentId, siteId, onDate)
  return rot
    ? { ok: true, rotation: rot }
    : { ok: false, reason: "No active rotation for date/site" }
}

// ---------- Clock System ----------
export const clockIn = (
  studentId: string,
  siteId: string,
  when: Date,
  ctx?: { ipAddress?: string; userAgent?: string; lat?: number; lon?: number }
): { ok: boolean; record?: ClockRecord; error?: string } => {
  const student = findStudent(studentId)
  const site = findSite(siteId)
  if (!student || !site) return { ok: false, error: "Student or site not found" }
  if (!isWithinOperatingHours(site, when))
    return { ok: false, error: "Outside site operating hours" }
  const rot = getRotationForDate(studentId, siteId, when)
  if (!rot) return { ok: false, error: "No active rotation scheduled" }
  if (!isWithinSlotWindow(site, rot, when))
    return { ok: false, error: "Outside assigned slot window" }
  const geo = validateGeofence(site, ctx?.lat, ctx?.lon)
  if (!geo.ok) return { ok: false, error: "Outside geofence" }
  // Prevent duplicate open records on same date
  const date = toISODate(when)
  const existingOpen = clockRecords.find(
    (cr) => cr.studentId === studentId && cr.date === date && cr.clockIn && !cr.clockOut
  )
  if (existingOpen) return { ok: false, error: "Open record already exists" }

  const record: ClockRecord = {
    id: uid("tr"),
    studentId,
    rotationId: rot.id,
    siteId: site.id,
    date,
    clockIn: when.toISOString(),
    metadata: {
      ipAddress: ctx?.ipAddress,
      userAgent: ctx?.userAgent,
      lat: ctx?.lat,
      lon: ctx?.lon,
      withinGeofence: geo.ok,
    },
  }
  clockRecords.push(record)
  return { ok: true, record }
}

export const clockOut = (
  studentId: string,
  when: Date,
  ctx?: { ipAddress?: string; userAgent?: string; lat?: number; lon?: number }
): { ok: boolean; record?: ClockRecord; error?: string } => {
  const date = toISODate(when)
  const open = clockRecords.find(
    (cr) => cr.studentId === studentId && cr.date === date && cr.clockIn && !cr.clockOut
  )
  if (!open) return { ok: false, error: "No open record found to clock out" }

  const site = findSite(open.siteId)
  const rot = findRotation(open.rotationId)
  if (!site || !rot) return { ok: false, error: "Invalid site or rotation for clock-out" }
  // Check shift length constraints
  const inTime = new Date(open.clockIn ?? when.toISOString())
  const diffHours = (when.getTime() - inTime.getTime()) / (1000 * 60 * 60)
  const maxShift = site.rules.maxShiftHours ?? 12
  if (diffHours <= 0) return { ok: false, error: "Clock-out must be after clock-in" }
  if (!site.rules.allowOvernight && toISODate(inTime) !== toISODate(when))
    return { ok: false, error: "Overnight shifts not allowed" }
  if (diffHours > maxShift) return { ok: false, error: `Shift exceeds max ${maxShift} hours` }

  open.clockOut = when.toISOString()
  open.totalHours = Math.round(diffHours * 100) / 100
  open.metadata = {
    ...(open.metadata ?? {}),
    ipAddress: ctx?.ipAddress,
    userAgent: ctx?.userAgent,
    lat: ctx?.lat,
    lon: ctx?.lon,
  }

  // Update student and rotation progress
  const student = findStudent(studentId)
  if (student) {
    student.completedHours += open.totalHours ?? 0
  }
  // Rotation hours tally (not persisted here)
  // In a real system, we would also update rotation.completedHours

  return { ok: true, record: open }
}

export const timeReportForStudent = (
  studentId: string,
  from?: Date,
  to?: Date
): { totalHours: number; records: ClockRecord[] } => {
  const startMs = from?.getTime() ?? -Infinity
  const endMs = to?.getTime() ?? Infinity
  const records = clockRecords.filter((cr) => {
    const inMs = cr.clockIn ? new Date(cr.clockIn).getTime() : new Date(cr.date).getTime()
    return cr.studentId === studentId && inMs >= startMs && inMs <= endMs
  })
  const totalHours = records.reduce((sum, r) => sum + (r.totalHours ?? 0), 0)
  return { totalHours: Math.round(totalHours * 100) / 100, records }
}

export const listEligibleSiteSlots = (studentId: string, onDate: Date) => {
  const sites = listAvailableSitesForStudent(studentId, onDate)
  const day = onDate.getDay()
  return sites.flatMap((site) =>
    site.slots.filter((s) => s.dayOfWeek === day).map((slot) => ({ site, slot }))
  )
}

export const resetClockRecords = () => {
  clockRecords.splice(0, clockRecords.length)
}

// Example usage (remove or adapt in integration tests):
// const now = new Date()
// const { ok, record, error } = clockIn("user_s01", "site_city_hospital", now, { lat: 40.7128, lon: -74.006 })
// if (ok) {
//   const out = clockOut("user_s01", new Date(now.getTime() + 3 * 60 * 60 * 1000))
// }
