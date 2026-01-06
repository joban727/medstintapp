"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { toast } from "sonner"
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  FileUp,
  ExternalLink,
  ShieldCheck,
  Calendar,
  AlertTriangle,
} from "lucide-react"
import { format, isPast, isWithinInterval, addDays } from "date-fns"
import { safeFetchApi } from "@/lib/safe-fetch"
import { DashboardBackground } from "@/components/dashboard/dashboard-background"
import { motion } from "framer-motion"

interface ComplianceRequirement {
  id: string
  name: string
  description: string
  type: "DOCUMENT" | "DATE" | "BOOLEAN"
  frequency: "ONCE" | "ANNUAL" | "BIENNIAL"
  isRequired: boolean
}

interface ComplianceSubmission {
  id: string
  requirementId: string
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"
  submissionData: any
  documentId: string
  notes: string
  expiresAt: string | null
}

interface RequirementWithSubmission extends ComplianceRequirement {
  submission?: ComplianceSubmission
}

export default function StudentComplianceClient({ userId }: { userId: string }) {
  const [requirements, setRequirements] = useState<RequirementWithSubmission[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchComplianceData()
  }, [])

  const fetchComplianceData = async () => {
    setIsLoading(true)
    try {
      // Fetch requirements and submissions in parallel
      const [reqRes, subRes] = await Promise.all([
        safeFetchApi("/api/compliance/requirements"),
        safeFetchApi("/api/compliance/submissions"),
      ])

      if (reqRes.success && subRes.success) {
        const reqs = reqRes.data as ComplianceRequirement[]
        const subs = subRes.data as {
          submission: ComplianceSubmission
          requirement: ComplianceRequirement
        }[]

        const merged = reqs.map((req) => ({
          ...req,
          submission: subs.find((s) => s.submission.requirementId === req.id)?.submission,
        }))

        setRequirements(merged)
      }
    } catch (error) {
      toast.error("Failed to load compliance data")
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusBadge = (req: RequirementWithSubmission) => {
    if (!req.submission) {
      return (
        <Badge variant="outline" className="bg-muted/50">
          Missing
        </Badge>
      )
    }

    switch (req.submission.status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            Approved
          </Badge>
        )
      case "PENDING":
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            Pending Review
          </Badge>
        )
      case "REJECTED":
        return <Badge variant="destructive">Rejected</Badge>
      case "EXPIRED":
        return <Badge variant="destructive">Expired</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getStatusIcon = (req: RequirementWithSubmission) => {
    if (!req.submission) return <AlertCircle className="h-5 w-5 text-muted-foreground" />

    switch (req.submission.status) {
      case "APPROVED":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      case "PENDING":
        return <Clock className="h-5 w-5 text-amber-500" />
      case "REJECTED":
        return <AlertTriangle className="h-5 w-5 text-destructive" />
      case "EXPIRED":
        return <AlertTriangle className="h-5 w-5 text-destructive" />
    }
  }

  const calculateOverallProgress = () => {
    if (requirements.length === 0) return 0
    const approved = requirements.filter((r) => r.submission?.status === "APPROVED").length
    return Math.round((approved / requirements.length) * 100)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        Loading compliance status...
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full">
      <DashboardBackground />

      <div className="relative z-10 space-y-6 max-w-5xl mx-auto">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-6 w-6" />
            <h1 className="text-3xl font-bold tracking-tight">Compliance Center</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your clinical requirements, immunizations, and certifications.
          </p>
        </header>

        <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Overall Compliance Progress</span>
                  <span className="text-primary font-bold">{calculateOverallProgress()}%</span>
                </div>
                <Progress value={calculateOverallProgress()} className="h-3" />
              </div>
              <div className="flex gap-4">
                <div className="text-center px-4 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <div className="text-2xl font-bold text-emerald-500">
                    {requirements.filter((r) => r.submission?.status === "APPROVED").length}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Approved
                  </div>
                </div>
                <div className="text-center px-4 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <div className="text-2xl font-bold text-amber-500">
                    {requirements.filter((r) => r.submission?.status === "PENDING").length}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Pending
                  </div>
                </div>
                <div className="text-center px-4 py-2 rounded-lg bg-destructive/5 border border-destructive/10">
                  <div className="text-2xl font-bold text-destructive">
                    {
                      requirements.filter(
                        (r) => !r.submission || r.submission.status === "REJECTED"
                      ).length
                    }
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Action Required
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {requirements.map((req, index) => (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="bg-card/40 backdrop-blur-sm hover:bg-card/60 transition-colors border-primary/5">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-full bg-background/50 border border-border/50`}>
                        {getStatusIcon(req)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{req.name}</h3>
                          {req.isRequired && (
                            <span className="text-[10px] text-destructive font-bold uppercase tracking-tighter">
                              * Required
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground max-w-md">{req.description}</p>
                        {req.submission?.expiresAt && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-500 font-medium pt-1">
                            <Calendar className="h-3 w-3" />
                            Expires: {format(new Date(req.submission.expiresAt), "MMM d, yyyy")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col sm:items-end gap-3 w-full sm:w-auto">
                      {getStatusBadge(req)}
                      <div className="flex gap-2">
                        {req.submission?.documentId && (
                          <Button variant="outline" size="sm" className="h-8 gap-1.5">
                            <ExternalLink className="h-3.5 w-3.5" />
                            View
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-8 gap-1.5"
                          variant={req.submission ? "secondary" : "default"}
                        >
                          <FileUp className="h-3.5 w-3.5" />
                          {req.submission ? "Update" : "Submit"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
