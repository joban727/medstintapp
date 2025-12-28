"use client"

import { Loader2, Users } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { safeFetchApi } from "@/lib/safe-fetch"

interface StudentItem {
  id: string
  name: string
  email?: string
  studentId?: string
}

interface ClinicalSiteItem {
  id: string
  name: string
  capacity?: number
}

interface AssignStudentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rotation: {
    id: string
    clinicalSiteId?: string | null
    startDate?: Date
    endDate?: Date
    currentAssigned?: number
    maxCapacity?: number
  } | null
  onSuccess?: () => void
}

function toDateInputValue(date?: Date): string {
  if (!date) return ""
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function AssignStudentsModal({
  open,
  onOpenChange,
  rotation,
  onSuccess,
}: AssignStudentsModalProps) {
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [students, setStudents] = useState<StudentItem[]>([])
  const [sites, setSites] = useState<ClinicalSiteItem[]>([])
  const [dataError, setDataError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [siteId, setSiteId] = useState<string>(rotation?.clinicalSiteId || "")
  const [startDate, setStartDate] = useState<string>(toDateInputValue(rotation?.startDate))
  const [endDate, setEndDate] = useState<string>(toDateInputValue(rotation?.endDate))

  // Keep local defaults in sync when rotation changes
  useEffect(() => {
    setSiteId(rotation?.clinicalSiteId || "")
    setStartDate(toDateInputValue(rotation?.startDate))
    setEndDate(toDateInputValue(rotation?.endDate))
  }, [rotation])

  const filteredStudents = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return students
    return students.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q) ||
        (s.studentId || "").toLowerCase().includes(q)
    )
  }, [students, search])

  const fetchData = useCallback(async () => {
    setIsLoadingData(true)
    setDataError(null)
    try {
      // Fetch school-scoped students
      const studentsResult = await safeFetchApi<{ students: any[] }>(
        "/api/students?active=true&limit=200"
      )
      if (!studentsResult.success) {
        throw new Error(studentsResult.error || "Failed to fetch students")
      }
      const rawStudents = studentsResult.data?.students ?? []
      const mappedStudents: StudentItem[] = Array.isArray(rawStudents)
        ? rawStudents.map((s: any) => ({
            id: s.id,
            name: s.name || "Unnamed",
            email: s.email,
            studentId: s.studentId,
          }))
        : []
      setStudents(mappedStudents)

      // Fetch clinical sites for optional override/selection
      const sitesResult = await safeFetchApi<{ clinicalSites: any[] }>(
        "/api/clinical-sites?isActive=true&limit=200"
      )
      if (!sitesResult.success) {
        throw new Error(sitesResult.error || "Failed to fetch clinical sites")
      }
      const rawSites = sitesResult.data?.clinicalSites ?? []
      const mappedSites: ClinicalSiteItem[] = Array.isArray(rawSites)
        ? rawSites.map((c: any) => ({
            id: c.id,
            name: c.name,
            capacity: typeof c.capacity === "number" ? c.capacity : undefined,
          }))
        : []
      setSites(mappedSites)
    } catch (error) {
      const msg = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[AssignStudentsModal] Data load failed:", error)
      setDataError(msg)
      toast.error(msg)
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      fetchData()
    } else {
      setSelectedIds([])
      setSearch("")
    }
  }, [open, fetchData])

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const selectAllFiltered = () => {
    const ids = filteredStudents.map((s) => s.id)
    const allSelected = ids.every((id) => selectedIds.includes(id))
    setSelectedIds(
      allSelected
        ? selectedIds.filter((id) => !ids.includes(id))
        : Array.from(new Set([...selectedIds, ...ids]))
    )
  }

  const canSubmit = selectedIds.length > 0 && !!siteId && !!startDate

  const handleSubmit = async () => {
    if (!rotation) return
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      // Capacity and overlap validation
      const selectedSite = sites.find((s) => s.id === siteId)
      const effectiveCapacity = selectedSite?.capacity ?? rotation.maxCapacity ?? undefined
      const chosenStart = new Date(startDate)
      const chosenEnd = endDate ? new Date(endDate) : undefined

      // Fetch existing ACTIVE assignments for the selected site
      const assignmentsResult = await safeFetchApi<any[]>(
        `/api/site-assignments?siteId=${encodeURIComponent(siteId)}&status=ACTIVE`
      )
      if (!assignmentsResult.success) {
        throw new Error(
          assignmentsResult.error || "Failed to validate existing assignments for capacity/overlap"
        )
      }
      const existingAssignments = Array.isArray(assignmentsResult.data)
        ? assignmentsResult.data
        : []

      // Helper: date overlap check
      const overlaps = (
        aStart: Date,
        aEnd: Date | undefined,
        bStart: Date,
        bEnd: Date | undefined
      ) => {
        const aE = aEnd ?? new Date(8640000000000000) // far future
        const bE = bEnd ?? new Date(8640000000000000)
        return aStart <= bE && bStart <= aE
      }

      // Filter existing assignments that overlap with the chosen period
      const overlappingAssignments = Array.isArray(existingAssignments)
        ? existingAssignments.filter((a: any) => {
            const aStart = new Date(a.startDate)
            const aEnd = a.endDate ? new Date(a.endDate) : undefined
            return overlaps(aStart, aEnd, chosenStart, chosenEnd)
          })
        : []

      // Check if any selected student already has overlapping assignment at this site
      const overlappingSelected = selectedIds.filter((sid) =>
        overlappingAssignments.some((a: any) => a.studentId === sid)
      )
      if (overlappingSelected.length > 0) {
        const namesPreview = overlappingSelected
          .map((sid) => students.find((s) => s.id === sid)?.name || sid)
          .slice(0, 3)
          .join(", ")
        toast.error(
          `Some students already have overlapping assignments at this site: ${namesPreview}${
            overlappingSelected.length > 3 ? ` (+${overlappingSelected.length - 3} more)` : ""
          }`
        )
        setIsSubmitting(false)
        return
      }

      // Capacity validation based on overlapping occupancy in the chosen window
      if (typeof effectiveCapacity === "number") {
        const currentOverlapDistinctStudentCount = new Set(
          overlappingAssignments.map((a: any) => a.studentId)
        ).size
        const projected = currentOverlapDistinctStudentCount + selectedIds.length
        if (projected > effectiveCapacity) {
          toast.error(
            `Capacity exceeded: ${projected}/${effectiveCapacity} overlapping assignments in the selected period.`
          )
          setIsSubmitting(false)
          return
        }
      }

      const payload = {
        clinicalSiteId: siteId,
        studentIds: selectedIds,
        rotationId: rotation.id,
        startDate: new Date(startDate).toISOString(),
        endDate: endDate ? new Date(endDate).toISOString() : undefined,
      }

      const resp = await fetch("/api/site-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}))
        throw new Error(err.error || err.message || "Failed to assign students")
      }

      toast.success(`Assigned ${selectedIds.length} student(s) to site`)
      setSelectedIds([])
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[AssignStudentsModal] Submit failed:", error)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Assign Students
          </DialogTitle>
          <DialogDescription>
            Select students to assign to this rotation’s clinical site.
          </DialogDescription>
          {dataError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-error text-sm">
              {dataError}
            </div>
          )}
        </DialogHeader>

        {/* Site selection and dates */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Clinical Site</Label>
            <Select value={siteId} onValueChange={setSiteId} disabled={isLoadingData}>
              <SelectTrigger>
                <SelectValue
                  placeholder={isLoadingData ? "Loading sites..." : "Select clinical site"}
                />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End Date (optional)</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* Search and list */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search students..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              onClick={selectAllFiltered}
              disabled={isLoadingData}
            >
              {filteredStudents.length > 0 &&
              filteredStudents.every((s) => selectedIds.includes(s.id))
                ? "Deselect All"
                : "Select All"}
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border p-2">
            {isLoadingData ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">No students found</div>
            ) : (
              filteredStudents.map((s) => (
                <div key={s.id} className="flex items-center gap-3 py-2">
                  <Checkbox
                    id={`student-${s.id}`}
                    checked={selectedIds.includes(s.id)}
                    onCheckedChange={() => toggleStudent(s.id)}
                  />
                  <Label htmlFor={`student-${s.id}`} className="flex-1">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-sm text-muted-foreground">{s.email || s.studentId}</div>
                  </Label>
                </div>
              ))
            )}
          </div>
          <div className="text-sm text-muted-foreground">Selected: {selectedIds.length}</div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Assign Students
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
