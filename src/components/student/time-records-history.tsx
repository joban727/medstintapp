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

interface TimeRecord {
  id: string
  clockInTime: string
  clockOutTime?: string
  totalHours?: number
  status: "active" | "completed"
  clinicalSite: {
    id: string
    name: string
    address: string
  }
  rotation: {
    id: string
    name: string
  }
  notes?: string
  createdAt: string
}

interface TimeRecordsHistoryProps {
  studentId?: string
}

export default function TimeRecordsHistory({ studentId }: TimeRecordsHistoryProps) {
  const [records, setRecords] = useState<TimeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    status: "all",
    siteId: "all",
    dateFrom: "",
    dateTo: "",
  })
  const [sites, setSites] = useState<{ id: string; name: string }[]>([])

  const fetchTimeRecords = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()

      if (filter.status !== "all") params.append("status", filter.status)
      if (filter.siteId !== "all") params.append("siteId", filter.siteId)
      if (filter.dateFrom) params.append("dateFrom", filter.dateFrom)
      if (filter.dateTo) params.append("dateTo", filter.dateTo)

      const response = await fetch(`/api/time-records/history?${params.toString()}`)

      if (!response.ok) {
        throw new Error("Failed to fetch time records")
      }

      const data = await response.json()
      setRecords(data.records || [])
    } catch (_error) {
      // Error fetching time records
      toast.error("Failed to load time records")
    } finally {
      setLoading(false)
    }
  }

  const fetchSites = async () => {
    try {
      const response = await fetch("/api/sites/available")
      if (response.ok) {
        const data = await response.json()
        setSites(data.sites || [])
      }
    } catch (_error) {
      // Error fetching sites
    }
  }

  useEffect(() => {
    fetchTimeRecords()
    fetchSites()
  }, [fetchSites, fetchTimeRecords])

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
    return (
      <Badge
        variant={status === "active" ? "default" : "secondary"}
        className={status === "active" ? "bg-green-500 hover:bg-green-600" : ""}
      >
        {status === "active" ? "Clocked In" : "Completed"}
      </Badge>
    )
  }

  const clearFilters = () => {
    setFilter({
      status: "all",
      siteId: "all",
      dateFrom: "",
      dateTo: "",
    })
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
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

            <div className="space-y-2">
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

            <div className="space-y-2">
              <Label htmlFor="date-from">From Date</Label>
              <Input
                id="date-from"
                type="date"
                value={filter.dateFrom}
                onChange={(e) => setFilter((prev) => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-to">To Date</Label>
              <Input
                id="date-to"
                type="date"
                value={filter.dateTo}
                onChange={(e) => setFilter((prev) => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Records List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Records History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-blue-600 border-b-2" />
            </div>
          ) : records.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <Clock className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No time records found</p>
              <p className="text-sm">
                Try adjusting your filters or clock in to create your first record
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="font-semibold">{record.clinicalSite.name}</h3>
                        {getStatusBadge(record.status)}
                      </div>

                      <div className="grid grid-cols-1 gap-2 text-gray-600 text-sm md:grid-cols-2">
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
                        <div className="mt-2 text-gray-600 text-sm">
                          <strong>Notes:</strong> {record.notes}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      {record.totalHours && (
                        <div className="font-semibold text-blue-600 text-lg">
                          {formatDuration(record.totalHours)}
                        </div>
                      )}
                      <div className="text-gray-500 text-xs">
                        {formatDateTime(record.createdAt)}
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
