"use client"

import { useState } from "react"
import { format, isAfter, isBefore, isWithinInterval } from "date-fns"
import {
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Circle,
  CalendarDays,
  Building2,
  GraduationCap,
  ArrowRight,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface StudentRotation {
  id: string
  status: string
  startDate: Date | null
  endDate: Date | null
  completedHours: number
  targetHours: number | null
  clinicalSiteId: string
  clinicalSiteName: string | null
  clinicalSiteAddress: string | null
  templateName: string | null
  specialty: string | null
  programName: string | null
  assignmentStatus: string | null
}

interface StudentRotationsClientProps {
  rotations: StudentRotation[]
}

export function StudentRotationsClient({ rotations }: StudentRotationsClientProps) {
  const now = new Date()

  // Helper to check if rotation has valid dates
  const hasDates = (
    r: StudentRotation
  ): r is StudentRotation & { startDate: Date; endDate: Date } => {
    return !!r.startDate && !!r.endDate
  }

  const currentRotation = rotations.find(
    (r) =>
      hasDates(r) &&
      isWithinInterval(now, { start: new Date(r.startDate), end: new Date(r.endDate) })
  )

  const upcomingRotations = rotations.filter(
    (r) => hasDates(r) && isAfter(new Date(r.startDate), now)
  )

  const pastRotations = rotations.filter((r) => hasDates(r) && isBefore(new Date(r.endDate), now))

  const getTargetHours = (r: StudentRotation) => r.targetHours || 0

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Rotations</h1>
        <p className="text-muted-foreground mt-2">
          View your current schedule, track progress, and prepare for upcoming clinical assignments.
        </p>
      </div>

      {/* Current Rotation Hero Card */}
      {currentRotation ? (
        <Card className="border-blue-100 dark:border-blue-900 bg-gradient-to-br from-white to-blue-50/50 dark:from-slate-900 dark:to-blue-950/50 shadow-lg overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <GraduationCap className="w-32 h-32 text-blue-600" />
          </div>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1">
                Current Rotation
              </Badge>
              <span className="text-sm font-medium text-blue-600 flex items-center gap-1">
                <CalendarDays className="w-4 h-4" />
                {currentRotation.startDate && format(new Date(currentRotation.startDate), "MMM d")}{" "}
                -{" "}
                {currentRotation.endDate &&
                  format(new Date(currentRotation.endDate), "MMM d, yyyy")}
              </span>
            </div>
            <CardTitle className="text-2xl mt-4 flex items-center gap-2">
              {currentRotation.templateName || "Clinical Rotation"}
              <span className="text-lg font-normal text-muted-foreground">
                • {currentRotation.specialty}
              </span>
            </CardTitle>
            <CardDescription className="flex items-center gap-2 text-base">
              <Building2 className="w-4 h-4" />
              {currentRotation.clinicalSiteName}
              {currentRotation.clinicalSiteAddress && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({currentRotation.clinicalSiteAddress})
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Hours Completed</span>
                  <span className="font-medium">
                    {currentRotation.completedHours} / {getTargetHours(currentRotation)}
                  </span>
                </div>
                <Progress
                  value={
                    getTargetHours(currentRotation) > 0
                      ? (currentRotation.completedHours / getTargetHours(currentRotation)) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/50 border border-blue-100">
                <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Time Remaining</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.max(0, getTargetHours(currentRotation) - currentRotation.completedHours)}{" "}
                    hours left
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white/50 border border-blue-100">
                <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Location</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                    {currentRotation.clinicalSiteName}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button asChild className="gap-2">
                <Link href={`/dashboard/student/evaluations/site?rotationId=${currentRotation.id}`}>
                  <MessageSquare className="w-4 h-4" />
                  Evaluate Site
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-muted/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No Active Rotation</h3>
            <p className="text-muted-foreground max-w-sm mt-2">
              You don't have a rotation currently in progress. Check your upcoming schedule below.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">History</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-6 space-y-4">
          {upcomingRotations.length > 0 ? (
            upcomingRotations.map((rotation) => (
              <Card key={rotation.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
                    <span className="text-xs font-medium uppercase">
                      {rotation.startDate && format(new Date(rotation.startDate), "MMM")}
                    </span>
                    <span className="text-xl font-bold">
                      {rotation.startDate && format(new Date(rotation.startDate), "d")}
                    </span>
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">
                        {rotation.templateName || "Clinical Rotation"}
                      </h3>
                      <Badge variant="outline" className="text-xs font-normal">
                        {rotation.specialty}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {rotation.clinicalSiteName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getTargetHours(rotation)} Hours
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <p className="text-sm font-medium">Starts in</p>
                      <p className="text-xs text-muted-foreground">
                        {rotation.startDate &&
                          Math.ceil(
                            (new Date(rotation.startDate).getTime() - new Date().getTime()) /
                              (1000 * 60 * 60 * 24)
                          )}{" "}
                        days
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No upcoming rotations scheduled.
            </div>
          )}
        </TabsContent>
        <TabsContent value="past" className="mt-6 space-y-4">
          {pastRotations.length > 0 ? (
            pastRotations.map((rotation) => (
              <Card key={rotation.id} className="opacity-75 hover:opacity-100 transition-opacity">
                <CardContent className="p-6 flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{rotation.templateName || "Clinical Rotation"}</h3>
                    <p className="text-sm text-muted-foreground">
                      {rotation.startDate && format(new Date(rotation.startDate), "MMM d, yyyy")} -{" "}
                      {rotation.endDate && format(new Date(rotation.endDate), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-2">
                    <div className="text-sm font-medium">
                      {rotation.completedHours} / {getTargetHours(rotation)} Hours
                    </div>
                    <Progress
                      value={
                        getTargetHours(rotation) > 0
                          ? (rotation.completedHours / getTargetHours(rotation)) * 100
                          : 0
                      }
                      className="w-24 h-2 mt-1"
                    />
                    <Button variant="outline" size="sm" asChild className="mt-2 gap-1.5 h-8">
                      <Link href={`/dashboard/student/evaluations/site?rotationId=${rotation.id}`}>
                        <MessageSquare className="w-3.5 h-3.5" />
                        Evaluate
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">No past rotations found.</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
