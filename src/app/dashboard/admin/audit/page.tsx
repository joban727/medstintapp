import { AlertTriangle, Download, Eye, Filter, Search, Shield, User } from "lucide-react"
import { headers } from "next/headers"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card"
import { Input } from "../../../../components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table"
import { requireAnyRole } from "../../../../lib/auth-clerk"

interface AuditLog {
  id: string
  userId: string | null
  action: string
  resource: string | null
  resourceId: string | null
  details: string | null
  ipAddress: string | null
  userAgent: string | null
  sessionId: string | null
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "INFO" | "WARNING"
  status: "SUCCESS" | "FAILURE" | "ERROR"
  createdAt: string
  userName: string | null
  userEmail: string | null
  userRole: string | null
  schoolId: string | null
  schoolName: string | null
}

async function getAuditLogs(): Promise<{ logs: AuditLog[]; total: number }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/api/audit-logs?limit=50`,
      {
        headers: {
          Cookie: (await headers()).get("cookie") || "",
        },
      }
    )

    if (!response.ok) {
      console.error("Failed to fetch audit logs:", response.statusText)
      return { logs: [], total: 0 }
    }

    const data = await response.json()
    return { logs: data.logs || [], total: data.pagination?.total || 0 }
  } catch (error) {
    console.error("Error fetching audit logs:", error)
    return { logs: [], total: 0 }
  }
}

export default async function AuditLogsPage() {
  const _user = await requireAnyRole(["SUPER_ADMIN"], "/dashboard")

  // Fetch real audit log data
  const { logs: auditLogs } = await getAuditLogs()

  const securityEvents = [
    {
      id: "sec-1",
      timestamp: new Date("2024-01-15T11:00:00Z"),
      type: "SUSPICIOUS_LOGIN",
      description: "Multiple failed login attempts from same IP",
      ipAddress: "203.0.113.45",
      userId: "user-456",
      userName: "Jane Smith",
      severity: "HIGH",
      status: "INVESTIGATING",
    },
    {
      id: "sec-2",
      timestamp: new Date("2024-01-14T14:30:00Z"),
      type: "PRIVILEGE_ESCALATION",
      description: "User role changed from STUDENT to SCHOOL_ADMIN",
      ipAddress: "192.168.1.100",
      userId: "user-123",
      userName: "John Doe",
      severity: "MEDIUM",
      status: "RESOLVED",
    },
  ]

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-100 text-red-800"
      case "HIGH":
        return "bg-orange-100 text-orange-800"
      case "WARNING":
        return "bg-yellow-100 text-yellow-800"
      case "MEDIUM":
        return "bg-blue-100 text-blue-800"
      case "INFO":
        return "bg-green-100 text-green-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getActionIcon = (action: string) => {
    if (action.includes("LOGIN") || action.includes("AUTH")) {
      return <Shield className="h-4 w-4" />
    }
    if (action.includes("USER") || action.includes("CREATED") || action.includes("DELETED")) {
      return <User className="h-4 w-4" />
    }
    return <Eye className="h-4 w-4" />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Audit Logs</h1>
          <p className="text-muted-foreground">Monitor system activities and security events</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Logs
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Filter className="mr-2 h-4 w-4" />
            Advanced Filter
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Events</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{auditLogs.length}</div>
            <p className="text-muted-foreground text-xs">Last 24 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Security Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{securityEvents.length}</div>
            <p className="text-muted-foreground text-xs">
              <span className="text-red-600">1 high priority</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Failed Logins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {auditLogs.filter((log) => log.action === "LOGIN_FAILED").length}
            </div>
            <p className="text-muted-foreground text-xs">Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Critical Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {auditLogs.filter((log) => log.severity === "CRITICAL").length}
            </div>
            <p className="text-muted-foreground text-xs">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search logs..." className="pl-8" />
            </div>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="USER_CREATED">User Created</SelectItem>
                <SelectItem value="LOGIN_FAILED">Login Failed</SelectItem>
                <SelectItem value="EVALUATION_SUBMITTED">Evaluation Submitted</SelectItem>
                <SelectItem value="SCHOOL_DELETED">School Deleted</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="WARNING">Warning</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="User Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                <SelectItem value="SCHOOL_ADMIN">School Admin</SelectItem>
                <SelectItem value="CLINICAL_SUPERVISOR">Clinical Supervisor</SelectItem>
                <SelectItem value="STUDENT">Student</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>System Activity Logs</CardTitle>
          <CardDescription>
            Detailed record of all system activities and user actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="text-sm">
                      {new Date(log.createdAt).toLocaleDateString()}
                      <br />
                      <span className="text-muted-foreground">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        {getActionIcon(log.action)}
                        <div>
                          <div className="font-medium">{log.userName || "Unknown User"}</div>
                          <div className="text-muted-foreground text-sm">
                            {log.userRole || "N/A"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.action.replace("_", " ")}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{log.resource || "N/A"}</div>
                      {log.resourceId && (
                        <div className="text-muted-foreground">{log.resourceId}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate text-sm" title={log.details || ""}>
                      {log.details || "No details available"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getSeverityColor(log.severity)}>{log.severity}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">{log.ipAddress || "N/A"}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Security Events */}
      <Card>
        <CardHeader>
          <CardTitle>Security Events</CardTitle>
          <CardDescription>Critical security incidents requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {securityEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <div className="font-medium">{event.type.replace("_", " ")}</div>
                    <div className="text-muted-foreground text-sm">{event.description}</div>
                    <div className="mt-1 text-muted-foreground text-xs">
                      {event.timestamp.toLocaleString()} • IP: {event.ipAddress}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getSeverityColor(event.severity)}>{event.severity}</Badge>
                  <Badge variant={event.status === "RESOLVED" ? "default" : "destructive"}>
                    {event.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
