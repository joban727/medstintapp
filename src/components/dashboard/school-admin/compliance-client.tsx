"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  ShieldCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  MoreVertical,
  Settings2,
  Users,
} from "lucide-react"
import { format } from "date-fns"
import { safeFetchApi } from "@/lib/safe-fetch"
import { DashboardBackground } from "@/components/dashboard/dashboard-background"
import { motion } from "framer-motion"

interface SubmissionWithDetails {
  submission: {
    id: string
    status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"
    createdAt: string
    notes: string
  }
  requirement: {
    name: string
  }
  studentName: string
}

interface ComplianceRequirement {
  id: string
  name: string
  description: string
  type: string
  isRequired: boolean
  frequency: string
  schoolId: string
}

export default function AdminComplianceClient({ userId }: { userId: string }) {
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([])
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAdminData()
  }, [])

  const fetchAdminData = async () => {
    setIsLoading(true)
    try {
      const [subRes, reqRes] = await Promise.all([
        safeFetchApi("/api/compliance/submissions"),
        safeFetchApi("/api/compliance/requirements"),
      ])

      if (subRes.success) setSubmissions(subRes.data as SubmissionWithDetails[])
      if (reqRes.success) setRequirements(reqRes.data as ComplianceRequirement[])
    } catch (error) {
      toast.error("Failed to load admin data")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReview = async (id: string, status: "APPROVED" | "REJECTED") => {
    try {
      const res = await safeFetchApi("/api/compliance/submissions", {
        method: "PUT",
        body: JSON.stringify({ id, status }),
      })

      if (res.success) {
        toast.success(`Submission ${status.toLowerCase()} successfully`)
        fetchAdminData()
      }
    } catch (error) {
      toast.error("Failed to review submission")
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        Loading compliance dashboard...
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full">
      <DashboardBackground />

      <div className="relative z-10 space-y-6 max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-6 w-6" />
              <h1 className="text-3xl font-bold tracking-tight">Compliance Management</h1>
            </div>
            <p className="text-muted-foreground">
              Review student submissions and manage program requirements.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Settings
            </Button>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Requirement
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {submissions.filter((s) => s.submission.status === "PENDING").length}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Pending Reviews
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{requirements.length}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Active Requirements
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">
                {submissions.filter((s) => s.submission.status === "APPROVED").length}
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Total Approved
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">94%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Compliance Rate
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="bg-background/50 backdrop-blur-sm border border-border/50">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pending
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {submissions.filter((s) => s.submission.status === "PENDING").length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Users className="h-4 w-4" />
              All Submissions
            </TabsTrigger>
            <TabsTrigger value="requirements" className="gap-2">
              <ShieldCheck className="h-4 w-4" />
              Requirements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            <div className="grid gap-4">
              {submissions
                .filter((s) => s.submission.status === "PENDING")
                .map((sub, index) => (
                  <motion.div
                    key={sub.submission.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-card/40 backdrop-blur-sm border-primary/5">
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                              {sub.studentName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-semibold">{sub.studentName}</div>
                              <div className="text-sm text-muted-foreground">
                                {sub.requirement.name}
                              </div>
                              <div className="text-[10px] text-muted-foreground uppercase pt-1">
                                Submitted{" "}
                                {format(new Date(sub.submission.createdAt), "MMM d, h:mm a")}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 sm:flex-none gap-1.5"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View Doc
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 sm:flex-none text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/5 border-emerald-500/20"
                              onClick={() => handleReview(sub.submission.id, "APPROVED")}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 sm:flex-none text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/20"
                              onClick={() => handleReview(sub.submission.id, "REJECTED")}
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              {submissions.filter((s) => s.submission.status === "PENDING").length === 0 && (
                <div className="text-center py-12 text-muted-foreground bg-card/20 rounded-xl border border-dashed border-border/50">
                  No pending submissions to review.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="all" className="mt-6">
            {/* Table or list of all submissions */}
            <Card className="bg-card/40 backdrop-blur-sm border-primary/5">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-background/50">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Student</th>
                        <th className="px-6 py-3 font-semibold">Requirement</th>
                        <th className="px-6 py-3 font-semibold">Status</th>
                        <th className="px-6 py-3 font-semibold">Date</th>
                        <th className="px-6 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {submissions.map((sub) => (
                        <tr
                          key={sub.submission.id}
                          className="hover:bg-background/30 transition-colors"
                        >
                          <td className="px-6 py-4 font-medium">{sub.studentName}</td>
                          <td className="px-6 py-4">{sub.requirement.name}</td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={
                                sub.submission.status === "APPROVED" ? "default" : "secondary"
                              }
                            >
                              {sub.submission.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-muted-foreground">
                            {format(new Date(sub.submission.createdAt), "MMM d, yyyy")}
                          </td>
                          <td className="px-6 py-4">
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requirements" className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {requirements.map((req) => (
                <Card key={req.id} className="bg-card/40 backdrop-blur-sm border-primary/5">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{req.name}</CardTitle>
                      <Badge variant="outline">{req.type}</Badge>
                    </div>
                    <CardDescription className="line-clamp-2">{req.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between pt-4">
                      <div className="text-xs text-muted-foreground">
                        {req.isRequired ? "Mandatory" : "Optional"} • {req.frequency}
                      </div>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
