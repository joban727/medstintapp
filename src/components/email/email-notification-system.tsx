"use client"
import { Bell, Check, Clock, Mail, Settings, Users, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { Checkbox } from "../ui/checkbox"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Switch } from "../ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Textarea } from "../ui/textarea"
import { toast } from "sonner"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface NotificationTemplate {
  id: string
  name: string
  subject: string
  content: string
  type: "assignment" | "evaluation" | "reminder" | "completion" | "overdue"
  variables: string[]
  enabled: boolean
}

interface NotificationPreference {
  userId: string
  emailEnabled: boolean
  smsEnabled: boolean
  pushEnabled: boolean
  frequency: "immediate" | "daily" | "weekly"
  types: {
    assignments: boolean
    evaluations: boolean
    reminders: boolean
    completions: boolean
    overdue: boolean
  }
}

interface ScheduledNotification {
  id: string
  templateId: string
  recipientId: string
  recipientEmail: string
  recipientName: string
  scheduledFor: string
  status: "pending" | "sent" | "failed"
  subject: string
  content: string
  type: string
}

export function EmailNotificationSystem() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    fetchNotificationData()
  }, [])

  const fetchNotificationData = async () => {
    try {
      setLoading(true)
      // Fetch templates
      const templatesResponse = await fetch("/api/notifications/templates")
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json()
        setTemplates(templatesData.templates || [])
      }

      // Fetch preferences
      const preferencesResponse = await fetch("/api/notifications/preferences")
      if (preferencesResponse.ok) {
        const preferencesData = await preferencesResponse.json()
        setPreferences(preferencesData.preferences || [])
      }

      // Fetch scheduled notifications
      const scheduledResponse = await fetch("/api/notifications/scheduled")
      if (scheduledResponse.ok) {
        const scheduledData = await scheduledResponse.json()
        setScheduledNotifications(scheduledData.notifications || [])
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[EmailNotificationSystem] Operation failed:", error)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const saveTemplate = async (template: NotificationTemplate) => {
    try {
      const response = await fetch("/api/notifications/templates", {
        method: template.id ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(template),
      })

      if (response.ok) {
        toast.success("Template saved successfully")
        fetchNotificationData()
        setSelectedTemplate(null)
        setIsEditing(false)
      } else {
        toast.error("Failed to save template")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[EmailNotificationSystem] Operation failed:", error)
      toast.error(errorMessage)
    }
  }

  const deleteTemplate = async (templateId: string) => {
    try {
      const response = await fetch(`/api/notifications/templates?id=${templateId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Template deleted successfully")
        fetchNotificationData()
      } else {
        toast.error("Failed to delete template")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[EmailNotificationSystem] Operation failed:", error)
      toast.error(errorMessage)
    }
  }

  const sendTestEmail = async (templateId: string) => {
    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId,
          recipientEmail: "test@example.com", // In real app, use current user's email
        }),
      })

      if (response.ok) {
        toast.success("Test email sent successfully")
      } else {
        toast.error("Failed to send test email")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[EmailNotificationSystem] Operation failed:", error)
      toast.error(errorMessage)
    }
  }

  const updatePreferences = async (
    userId: string,
    newPreferences: Partial<NotificationPreference>
  ) => {
    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          ...newPreferences,
        }),
      })

      if (response.ok) {
        toast.success("Preferences updated successfully")
        fetchNotificationData()
      } else {
        toast.error("Failed to update preferences")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[EmailNotificationSystem] Operation failed:", error)
      toast.error(errorMessage)
    }
  }

  const retryFailedNotification = async (notificationId: string) => {
    try {
      const response = await fetch("/api/notifications/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notificationId }),
      })

      if (response.ok) {
        toast.success("Notification retry initiated")
        fetchNotificationData()
      } else {
        toast.error("Failed to retry notification")
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[EmailNotificationSystem] Operation failed:", error)
      toast.error(errorMessage)
    }
  }

  if (loading) {
    return (
      <div className="gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse gap-2">
                  <div className="h-4 bg-muted rounded-md w-1/2" />
                  <div className="h-8 bg-muted rounded-md w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Notifications</h1>
          <p className="text-muted-foreground">
            Manage email templates, preferences, and notification scheduling
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setSelectedTemplate({
                id: "",
                name: "",
                subject: "",
                content: "",
                type: "assignment",
                variables: [],
                enabled: true,
              })
              setIsEditing(true)
            }}
          >
            <Mail className="mr-2 h-4 w-4" /> New Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="gap-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="gap-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{template.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant={template.enabled ? "default" : "secondary"}>
                        {template.enabled ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant="outline">{template.type}</Badge>
                    </div>
                  </div>
                  <CardDescription>{template.subject}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="gap-3">
                    <div className="text-sm text-muted-foreground">
                      Variables: {template.variables.join(", ") || "None"}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template)
                          setIsEditing(true)
                        }}
                      >
                        <Settings className="mr-1 h-3 w-3" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendTestEmail(template.id)}
                      >
                        <Mail className="mr-1 h-3 w-3" /> Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteTemplate(template.id)}
                      >
                        <X className="mr-1 h-3 w-3" /> Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Template Editor Modal */}
          {isEditing && selectedTemplate && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>{selectedTemplate.id ? "Edit Template" : "Create Template"}</CardTitle>
              </CardHeader>
              <CardContent className="gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="gap-2">
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={selectedTemplate.name}
                      onChange={(e) =>
                        setSelectedTemplate({
                          ...selectedTemplate,
                          name: e.target.value,
                        })
                      }
                      placeholder="Enter template name"
                    />
                  </div>
                  <div className="gap-2">
                    <Label htmlFor="template-type">Type</Label>
                    <Select
                      value={selectedTemplate.type}
                      onValueChange={(value: any) =>
                        setSelectedTemplate({
                          ...selectedTemplate,
                          type: value,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assignment">Assignment</SelectItem>
                        <SelectItem value="evaluation">Evaluation</SelectItem>
                        <SelectItem value="reminder">Reminder</SelectItem>
                        <SelectItem value="completion">Completion</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="gap-2">
                  <Label htmlFor="template-subject">Subject</Label>
                  <Input
                    id="template-subject"
                    value={selectedTemplate.subject}
                    onChange={(e) =>
                      setSelectedTemplate({
                        ...selectedTemplate,
                        subject: e.target.value,
                      })
                    }
                    placeholder="Enter email subject"
                  />
                </div>
                <div className="gap-2">
                  <Label htmlFor="template-content">Content</Label>
                  <Textarea
                    id="template-content"
                    value={selectedTemplate.content}
                    onChange={(e) =>
                      setSelectedTemplate({
                        ...selectedTemplate,
                        content: e.target.value,
                      })
                    }
                    placeholder="Enter email content (use {{variable}} for dynamic content)"
                    rows={8}
                  />
                </div>
                <div className="gap-2">
                  <Label htmlFor="template-variables">Variables (comma-separated)</Label>
                  <Input
                    id="template-variables"
                    value={selectedTemplate.variables.join(", ")}
                    onChange={(e) =>
                      setSelectedTemplate({
                        ...selectedTemplate,
                        variables: e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="studentName, competencyTitle, dueDate"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="template-enabled"
                    checked={selectedTemplate.enabled}
                    onCheckedChange={(checked) =>
                      setSelectedTemplate({
                        ...selectedTemplate,
                        enabled: checked,
                      })
                    }
                  />
                  <Label htmlFor="template-enabled">Template Enabled</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => saveTemplate(selectedTemplate)}>Save Template</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedTemplate(null)
                      setIsEditing(false)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="preferences" className="gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Notification Settings</CardTitle>
              <CardDescription>
                Configure default notification preferences for all users
              </CardDescription>
            </CardHeader>
            <CardContent className="gap-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="gap-4">
                  <h4 className="font-medium">Notification Types</h4>
                  <div className="gap-3">
                    {[
                      { key: "assignments", label: "New Assignments" },
                      { key: "evaluations", label: "Evaluation Requests" },
                      { key: "reminders", label: "Due Date Reminders" },
                      { key: "completions", label: "Completion Notifications" },
                      { key: "overdue", label: "Overdue Alerts" },
                    ].map((type) => (
                      <div key={type.key} className="flex items-center gap-2">
                        <Checkbox id={type.key} defaultChecked />
                        <Label htmlFor={type.key}>{type.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="gap-4">
                  <h4 className="font-medium">Delivery Methods</h4>
                  <div className="gap-3">
                    <div className="flex items-center gap-2">
                      <Switch id="email-enabled" defaultChecked />
                      <Label htmlFor="email-enabled">Email Notifications</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="sms-enabled" />
                      <Label htmlFor="sms-enabled">SMS Notifications</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch id="push-enabled" defaultChecked />
                      <Label htmlFor="push-enabled">Push Notifications</Label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="gap-2">
                <Label htmlFor="frequency">Default Frequency</Label>
                <Select defaultValue="immediate">
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="daily">Daily Digest</SelectItem>
                    <SelectItem value="weekly">Weekly Summary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button>Save Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduled" className="gap-4">
          <div className="grid gap-4">
            {scheduledNotifications.map((notification) => (
              <Card key={notification.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="gap-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{notification.subject}</h4>
                        <Badge
                          variant={
                            notification.status === "sent"
                              ? "default"
                              : notification.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {notification.status === "sent" && <Check className="mr-1 h-3 w-3" />}
                          {notification.status === "failed" && <X className="mr-1 h-3 w-3" />}
                          {notification.status === "pending" && <Clock className="mr-1 h-3 w-3" />}
                          {notification.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        To: {notification.recipientName} ({notification.recipientEmail})
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Scheduled: {new Date(notification.scheduledFor).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {notification.status === "failed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryFailedNotification(notification.id)}
                        >
                          Retry
                        </Button>
                      )}
                      <Badge variant="outline">{notification.type}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="gap-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex items-center justify-between gap-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1,234</div>
                <p className="text-xs text-muted-foreground">+12% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between gap-0 pb-2">
                <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                <Check className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">98.5%</div>
                <p className="text-xs text-muted-foreground">+0.5% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between gap-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
                <Bell className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">76.2%</div>
                <p className="text-xs text-muted-foreground">+2.1% from last month</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex items-center justify-between gap-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">456</div>
                <p className="text-xs text-muted-foreground">+8% from last month</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
