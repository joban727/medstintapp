// TODO: Add cache invalidation hooks for mutations
"use client"

import { Clock, Edit, Play, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Switch } from "../ui/switch"

interface ScheduledReport {
  id: string
  name: string
  type: string
  frequency: string
  recipients: string[]
  format: string
  isActive: boolean
  nextRun: string
  lastRun?: string
  filters: any
}

interface ScheduledReportsProps {
  userId: string
  userRole: string
}

export function ScheduledReports({ userId, userRole }: ScheduledReportsProps) {
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    type: "progress",
    frequency: "weekly",
    recipients: "",
    format: "pdf",
    isActive: true,
  })

  const fetchScheduledReports = async () => {
    try {
      const response = await fetch("/api/reports/scheduled")
      if (response.ok) {
        const data = await response.json()
        setScheduledReports(data.reports || [])
      }
    } catch (_error) {
      // Error fetching scheduled reports
    }
  }

  useEffect(() => {
    fetchScheduledReports()
  }, [fetchScheduledReports])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        ...formData,
        recipients: formData.recipients
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
        filters: {}, // Add default filters based on user role
      }

      const url = editingReport
        ? `/api/reports/scheduled/${editingReport.id}`
        : "/api/reports/scheduled"

      const method = editingReport ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error("Failed to save scheduled report")
      }

      toast.success(editingReport ? "Report updated successfully" : "Report scheduled successfully")
      setDialogOpen(false)
      setEditingReport(null)
      setFormData({
        name: "",
        type: "progress",
        frequency: "weekly",
        recipients: "",
        format: "pdf",
        isActive: true,
      })
      fetchScheduledReports()
    } catch (_error) {
      // Error saving scheduled report
      toast.error("Failed to save scheduled report")
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (report: ScheduledReport) => {
    setEditingReport(report)
    setFormData({
      name: report.name,
      type: report.type,
      frequency: report.frequency,
      recipients: report.recipients.join(", "),
      format: report.format,
      isActive: report.isActive,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this scheduled report?")) {
      return
    }

    try {
      const response = await fetch(`/api/reports/scheduled/${reportId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete scheduled report")
      }

      toast.success("Scheduled report deleted successfully")
      fetchScheduledReports()
    } catch (_error) {
      // Error deleting scheduled report
      toast.error("Failed to delete scheduled report")
    }
  }

  const handleToggleActive = async (reportId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/reports/scheduled/${reportId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      })

      if (!response.ok) {
        throw new Error("Failed to update report status")
      }

      toast.success(`Report ${isActive ? "activated" : "deactivated"} successfully`)
      fetchScheduledReports()
    } catch (_error) {
      // Error updating report status
      toast.error("Failed to update report status")
    }
  }

  const handleRunNow = async (reportId: string) => {
    try {
      const response = await fetch(`/api/reports/scheduled/${reportId}/run`, {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to run report")
      }

      toast.success("Report is being generated and will be sent to recipients")
      fetchScheduledReports()
    } catch (_error) {
      // Error running report
      toast.error("Failed to run report")
    }
  }

  const getFrequencyLabel = (frequency: string) => {
    const labels = {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      quarterly: "Quarterly",
    }
    return labels[frequency as keyof typeof labels] || frequency
  }

  const getStatusBadge = (report: ScheduledReport) => {
    if (!report.isActive) {
      return <Badge variant="secondary">Inactive</Badge>
    }

    const nextRun = new Date(report.nextRun)
    const now = new Date()

    if (nextRun < now) {
      return <Badge variant="destructive">Overdue</Badge>
    }

    return <Badge variant="default">Active</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Scheduled Reports</h3>
          <p className="text-muted-foreground text-sm">Automate report generation and delivery</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Schedule Report
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingReport ? "Edit Scheduled Report" : "Schedule New Report"}
              </DialogTitle>
              <DialogDescription>
                Configure automatic report generation and delivery settings.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Report Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Weekly Progress Report"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">Report Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="progress">Progress Report</SelectItem>
                      <SelectItem value="competency_analytics">Competency Analytics</SelectItem>
                      <SelectItem value="assessment_summary">Assessment Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipients">Recipients (comma-separated emails)</Label>
                <Input
                  id="recipients"
                  value={formData.recipients}
                  onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                  placeholder="admin@example.com, supervisor@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="format">Export Format</Label>
                <Select
                  value={formData.format}
                  onValueChange={(value) => setFormData({ ...formData, format: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="active">Active</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : editingReport ? "Update" : "Schedule"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {scheduledReports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Clock className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 font-semibold text-lg">No Scheduled Reports</h3>
              <p className="mb-4 text-center text-muted-foreground">
                Create your first scheduled report to automate report generation and delivery.
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Your First Report
              </Button>
            </CardContent>
          </Card>
        ) : (
          scheduledReports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {report.name}
                      {getStatusBadge(report)}
                    </CardTitle>
                    <CardDescription>
                      {report.type.replace("_", " ").toUpperCase()} •{" "}
                      {getFrequencyLabel(report.frequency)} • {report.format.toUpperCase()}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={report.isActive}
                      onCheckedChange={(checked) => handleToggleActive(report.id, checked)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Next Run:</span>
                      <br />
                      {new Date(report.nextRun).toLocaleString()}
                    </div>
                    {report.lastRun && (
                      <div>
                        <span className="font-medium">Last Run:</span>
                        <br />
                        {new Date(report.lastRun).toLocaleString()}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="font-medium text-sm">Recipients:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {report.recipients.map((email, index) => (
                        <Badge key={`recipient-${email}-${index}`} variant="outline" className="text-xs">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRunNow(report.id)}
                      disabled={!report.isActive}
                    >
                      <Play className="mr-1 h-3 w-3" />
                      Run Now
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleEdit(report)}>
                      <Edit className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(report.id)}>
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
