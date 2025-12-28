// Student dashboard types
export interface ClockStatus {
  status: "in" | "out"
  lastClockIn?: Date
  currentSite?: string
}

export interface Site {
  id: string
  name: string
  address: string
}

export interface TimeRecord {
  id: string
  date: string
  clockIn: string
  clockOut: string
  site: string
  totalHours: number
}

export interface StudentData {
  id: string
  name: string
  email: string
  program: string
  school: string
  totalHours: number
  requiredHours: number
  attendance: number
  evaluations: number
  upcomingShifts: Array<{
    id: string
    date: string
    time: string
    site: string
    department: string
  }>
  recentActivity: Array<{
    id: string
    type: string
    description: string
    date: string
    status: string
  }>
}
