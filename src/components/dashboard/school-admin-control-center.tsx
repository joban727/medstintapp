"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar, Clock, MapPin, Users } from "lucide-react"
import { ProgramsClient } from "@/components/dashboard/programs-client"
import { SchoolRotationsClient } from "@/components/dashboard/school-rotations-client"
import TimeRecordsHistory from "@/components/student/time-records-history"
import { trackClick } from "@/lib/click-telemetry"

interface RotationItem {
  id: string
  specialty: string
  startDate: string
  endDate: string
  status: string
  studentId: string | null
  studentName?: string | null
  clinicalSiteId: string | null
  clinicalSiteName?: string | null
}

interface ProgramItem {
  id: string
  name: string
  description: string
  duration: number | null
  classYear: number
  isActive: boolean
  createdAt: string
  updatedAt: string | null
  stats?: { totalStudents?: number }
}

interface SiteItem {
  id: string
  name: string
  address: string
  contactPerson?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  isActive: boolean
}

export function SchoolAdminControlCenter() {
  const [activeTab, setActiveTab] = useState("schedule")
  const [programs, setPrograms] = useState<ProgramItem[]>([])
  const [programStats, setProgramStats] = useState({
    totalPrograms: 0,
    activePrograms: 0,
    totalStudents: 0,
    avgStudentsPerProgram: 0,
  })
  const [rotations, setRotations] = useState<RotationItem[]>([])
  const [sites, setSites] = useState<SiteItem[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    const loadPrograms = async () => {
      try {
        const res = await fetch(`/api/programs?includeStats=true`)
        if (!res.ok) return
        const data = await res.json()
        const payload = data?.data?.items ?? data?.data ?? data?.items ?? []
        const items = Array.isArray(payload) ? (payload as ProgramItem[]) : []
        setPrograms(items)
        const totalStudents = items.reduce((sum, p) => sum + (p.stats?.totalStudents || 0), 0)
        const activePrograms = items.filter((p) => p.isActive).length
        setProgramStats({
          totalPrograms: items.length,
          activePrograms,
          totalStudents,
          avgStudentsPerProgram: items.length ? Math.round(totalStudents / items.length) : 0,
        })
      } catch {}
    }
    const loadRotations = async () => {
      try {
        const res = await fetch(`/api/rotations`)
        if (!res.ok) return
        const json = await res.json()
        const items = (json?.data?.items ?? json?.data ?? []) as any[]
        const mapped: RotationItem[] = items.map((r) => ({
          id: r.id,
          specialty: r.specialty,
          startDate: r.startDate,
          endDate: r.endDate,
          status: r.status,
          studentId: r.studentId ?? null,
          studentName: r.studentName ?? null,
          clinicalSiteId: r.clinicalSiteId ?? null,
          clinicalSiteName: r.clinicalSiteName ?? null,
        }))
        setRotations(mapped)
      } catch {}
    }
    const loadSites = async () => {
      try {
        const res = await fetch(`/api/sites/available`)
        if (!res.ok) return
        const data = await res.json()
        const payload = data?.data?.sites ?? data?.sites ?? []
        const items: SiteItem[] = payload.map((s: any) => ({
          id: String(s.id),
          name: s.name,
          address: s.address ?? "",
          contactPerson: s.contactPerson ?? null,
          contactEmail: s.contactEmail ?? null,
          contactPhone: s.contactPhone ?? null,
          isActive: s.isActive ?? true,
        }))
        setSites(items)
      } catch {}
    }
    loadPrograms()
    loadRotations()
    loadSites()
  }, [])

  const filteredRotations = useMemo(() => {
    if (!search) return rotations
    const q = search.toLowerCase()
    return rotations.filter(
      (r) =>
        r.specialty?.toLowerCase().includes(q) ||
        r.studentName?.toLowerCase().includes(q) ||
        r.clinicalSiteName?.toLowerCase().includes(q)
    )
  }, [rotations, search])

  const rotationDetails = useMemo(() => {
    return filteredRotations.map((r) => ({
      id: r.id,
      title: r.specialty ?? "Rotation",
      specialty: r.specialty ?? "",
      clinicalSite: r.clinicalSiteName ?? "",
      clinicalSiteId: r.clinicalSiteId,
      preceptorName: "",
      startDate: new Date(r.startDate),
      endDate: new Date(r.endDate),
      status: (r.status as any) || "SCHEDULED",
      studentsAssigned: 1,
      maxStudents: 1,
      attendanceRate: 100,
    }))
  }, [filteredRotations])

  const statusCounts = useMemo(() => {
    return {
      SCHEDULED: rotationDetails.filter((r) => r.status === "SCHEDULED").length,
      ACTIVE: rotationDetails.filter((r) => r.status === "ACTIVE").length,
      COMPLETED: rotationDetails.filter((r) => r.status === "COMPLETED").length,
      CANCELLED: rotationDetails.filter((r) => r.status === "CANCELLED").length,
    }
  }, [rotationDetails])

  return (
    <div className="gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Control Center</span>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search rotations, programs, sites"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[280px]"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v)
              trackClick("control-center.tab", { tab: v })
            }}
            className="space-y-4"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="programs">Programs</TabsTrigger>
              <TabsTrigger value="sites">Sites</TabsTrigger>
              <TabsTrigger value="time">Time & Attendance</TabsTrigger>
            </TabsList>

            <TabsContent value="schedule" className="space-y-4">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <SchoolRotationsClient
                    rotationDetails={rotationDetails as any}
                    statusCounts={statusCounts as any}
                  />
                </div>
                <div className="w-full lg:w-[340px] rounded-lg border p-4">
                  <div className="font-semibold mb-2">Context Panel</div>
                  <div className="text-sm text-muted-foreground mb-3">
                    Select a rotation to view details, capacity, and related actions.
                  </div>
                  <Separator className="my-2" />
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Drag-and-drop timeline planned in next iteration</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>Capacity checks and conflict detection</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>Time log overlays for selected rotation</span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="programs" className="space-y-4">
              <ProgramsClient
                initialPrograms={
                  programs.map((p) => ({
                    ...p,
                    createdAt: new Date(p.createdAt) as any,
                    updatedAt: p.updatedAt ? (new Date(p.updatedAt) as any) : null,
                    studentCount: p.stats?.totalStudents || 0,
                  })) as any
                }
                initialStats={programStats as any}
                schoolId={""}
              />
            </TabsContent>

            <TabsContent value="sites" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Clinical Sites</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {sites.map((site) => (
                      <div key={site.id} className="rounded-lg border p-3">
                        <div className="font-medium">{site.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-4 w-4" /> {site.address}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant={site.isActive ? "default" : "secondary"}>
                            {site.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => trackClick("site.view", { siteId: site.id })}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => trackClick("site.edit", { siteId: site.id })}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="time" className="space-y-4">
              <TimeRecordsHistory />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

export default SchoolAdminControlCenter
