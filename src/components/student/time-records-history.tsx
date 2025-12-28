"use client"

import { Calendar, Clock, Filter, MapPin } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { safeFetchApi } from "@/lib/safe-fetch"

interface TimeRecord {
  id: string
  clockInTime: string
  clockOutTime?: string
  totalHours?: number
  status: "active" | "completed" | string
  clinicalSite: { id: string; name: string; address: string }
  rotation: { id: string; name: string }
  notes?: string
  createdAt: string
}

interface TimeRecordsHistoryProps {
  studentId?: string
}

export default function TimeRecordsHistory({ studentId }: TimeRecordsHistoryProps) {
  const [records, setRecords] = useState<TimeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: "all", siteId: "all", dateFrom: "", dateTo: "" })
  const [sites, setSites] = useState<{ id: string; name: string }[]>([])
  const [newRecord, setNewRecord] = useState({
    siteId: "",
    date: "",
    clockIn: "",
    clockOut: "",
    notes: "",
  })

  const fetchTimeRecords = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filter.status !== "all") params.append("status", filter.status)
      if (filter.siteId !== "all") params.append("siteId", filter.siteId)
      if (filter.dateFrom) params.append("dateFrom", filter.dateFrom)
      if (filter.dateTo) params.append("dateTo", filter.dateTo)
      if (studentId) params.append("studentId", studentId)

      const result = await safeFetchApi<any>(`/api/time-records/history?${params.toString()}`)

      if (result.success) {
        const data = result.data
        setRecords((data.data?.records || []).map((r: any) => normalizeRecord(r)))
      } else {
        throw new Error(result.error || "Failed to fetch time records")
      }
    } catch (err: any) {
      const message = typeof err?.message === "string" ? err.message : "Failed to load time records"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const fetchSites = async () => {
    try {
      const result = await safeFetchApi<any>("/api/sites/available")
      if (result.success) {
        const data = result.data
        const sitesPayload = data?.data?.sites ?? []
        setSites(sitesPayload.map((s: any) => ({ id: String(s.id), name: s.name })))
      }
    } catch {}
  }

  const createTimeRecord = async () => {
    try {
      const body: any = {
        siteId: newRecord.siteId,
        date: newRecord.date,
        clockIn: newRecord.clockIn,
        notes: newRecord.notes,
      }
      if (newRecord.clockOut) body.clockOut = newRecord.clockOut

      const result = await safeFetchApi<any>("/api/time-records", {
        method: "POST",
        body: JSON.stringify(body),
      })

      if (result.success) {
        toast.success("Time record created")
        setNewRecord({ siteId: "", date: "", clockIn: "", clockOut: "", notes: "" })
        await fetchTimeRecords()
      } else {
        throw new Error(result.error || "Failed to create time record")
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to create time record")
    }
  }

  const deleteTimeRecord = async (id: string) => {
    try {
      const result = await safeFetchApi<any>(`/api/time-records?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      })

      if (result.success) {
        toast.success("Time record deleted")
        await fetchTimeRecords()
      } else {
        throw new Error(result.error || "Failed to delete time record")
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete time record")
    }
  }

  const clockOutRecord = async (id: string) => {
    try {
      const result = await safeFetchApi<any>(`/api/time-records?id=${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ clockOut: new Date().toISOString() }),
      })

      if (result.success) {
        toast.success("Clocked out")
        await fetchTimeRecords()
      } else {
        throw new Error(result.error || "Failed to clock out")
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to clock out")
    }
  }

  useEffect(() => {
    fetchTimeRecords()
    fetchSites()
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchTimeRecords()
    }, 200)
    return () => clearTimeout(timeout)
  }, [filter.status, filter.siteId, filter.dateFrom, filter.dateTo, studentId])

  const formatDuration = (hours: number) => {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return `${wholeHours}h ${minutes}m`
  }

  const formatDateTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusBadge = (status: string) => {
    const isActive = status === "active" || status === "PENDING"
    return (
      <Badge variant={isActive ? "default" : "secondary"}>
        {isActive ? "Clocked In" : "Completed"}
      </Badge>
    )
  }

  const clearFilters = () => {
    setFilter({ status: "all", siteId: "all", dateFrom: "", dateTo: "" })
    fetchTimeRecords()
  }

  function normalizeRecord(r: any): TimeRecord {
    const site = r.clinicalSite || {
      id: r.siteId || "",
      name: r.siteName || "",
      address: r.siteAddress || "",
    }
    const rotation = r.rotation || {
      id: r.rotationId || "",
      name: r.rotationSpecialty || r.specialty || "",
    }
    const clockIn = r.clockInTime || r.clockIn
    const clockOut = r.clockOutTime || r.clockOut
    const total = typeof r.totalHours === "string" ? Number(r.totalHours) : r.totalHours
    const created = r.createdAt || clockIn || new Date().toISOString()
    const status = r.status || (clockOut ? "completed" : "active")
    return {
      id: r.id,
      clinicalSite: site,
      rotation,
      clockInTime: clockIn,
      clockOutTime: clockOut,
      totalHours: total,
      status,
      notes: r.notes,
      createdAt: created,
    }
  }

  return (
    <div className="gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Add Time Record
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="gap-2">
              <Label htmlFor="new-site">Clinical Site</Label>
              <Select
                value={newRecord.siteId}
                onValueChange={(v) => setNewRecord((p) => ({ ...p, siteId: v }))}
              >
                <SelectTrigger id="new-site">
                  <SelectValue placeholder="Select a site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="gap-2">
              <Label htmlFor="new-date">Date</Label>
              <Input
                id="new-date"
                type="date"
                value={newRecord.date}
                onChange={(e) => setNewRecord((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div className="gap-2">
              <Label htmlFor="new-in">Clock In</Label>
              <Input
                id="new-in"
                type="datetime-local"
                value={newRecord.clockIn}
                onChange={(e) => setNewRecord((p) => ({ ...p, clockIn: e.target.value }))}
              />
            </div>
            <div className="gap-2">
              <Label htmlFor="new-out">Clock Out (optional)</Label>
              <Input
                id="new-out"
                type="datetime-local"
                value={newRecord.clockOut}
                onChange={(e) => setNewRecord((p) => ({ ...p, clockOut: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4">
            <Label htmlFor="new-notes">Notes</Label>
            <Input
              id="new-notes"
              value={newRecord.notes}
              onChange={(e) => setNewRecord((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={createTimeRecord}
              disabled={!newRecord.siteId || !newRecord.date || !newRecord.clockIn}
            >
              Create
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" /> Filter Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="gap-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select
                value={filter.status}
                onValueChange={(value) => setFilter((prev) => ({ ...prev, status: value }))}
              >
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="gap-2">
              <Label htmlFor="site-filter">Clinical Site</Label>
              <Select
                value={filter.siteId}
                onValueChange={(value) => setFilter((prev) => ({ ...prev, siteId: value }))}
              >
                <SelectTrigger id="site-filter">
                  <SelectValue placeholder="All sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="gap-2">
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={filter.dateFrom}
                onChange={(e) => setFilter((prev) => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            <div className="gap-2">
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={filter.dateTo}
                onChange={(e) => setFilter((prev) => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={fetchTimeRecords}>
              Refresh
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Time Records History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-medical-primary" />
            </div>
          ) : records.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Clock className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No time records found</p>
              <p className="text-sm">
                Try adjusting your filters or clock in to create your first record
              </p>
            </div>
          ) : (
            <div className="gap-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-muted/30"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="font-semibold">{record.clinicalSite.name}</h3>
                        {getStatusBadge(record.status)}
                      </div>
                      <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground md:grid-cols-2">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span>{record.clinicalSite.address}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span>{record.rotation.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>In: {formatDateTime(record.clockInTime)}</span>
                        </div>
                        {record.clockOutTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>Out: {formatDateTime(record.clockOutTime)}</span>
                          </div>
                        )}
                      </div>
                      {record.notes && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <strong>Notes:</strong> {record.notes}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {typeof record.totalHours === "number" && (
                        <div className="text-lg font-semibold text-medical-primary">
                          {formatDuration(record.totalHours)}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(record.createdAt)}
                      </div>
                      <div className="mt-2 flex justify-end gap-2">
                        {!record.clockOutTime && (
                          <Button variant="secondary" onClick={() => clockOutRecord(record.id)}>
                            Clock Out
                          </Button>
                        )}
                        <Button variant="destructive" onClick={() => deleteTimeRecord(record.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
