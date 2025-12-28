"use client"

import { AlertCircle, CheckCircle, Clock, Play, Square } from "lucide-react"
import { useCallback, useEffect, useId, useState } from "react"
import { toast } from "sonner"
import { clockIn, clockOut, updateTimeRecord } from "@/app/actions/medstint"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Checkbox } from "./ui/checkbox"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"

interface TimeTrackerProps {
    currentRotation: {
        id: string
        specialty: string
        clinicalSite: {
            name: string
        }
    } | null
    todayTimeRecord?: {
        id: string
        clockIn: Date
        clockOut: Date | null
        totalHours: string
        activities: string
        notes: string | null
        status: string
    } | null
    onTimeRecordUpdate?: (updatedRecord: any) => void
}

const ACTIVITY_OPTIONS = [
    "Patient Care",
    "Medication Administration",
    "Documentation",
    "Patient Assessment",
    "Procedures",
    "Education/Learning",
    "Team Meetings",
    "Emergency Response",
    "Quality Improvement",
    "Other",
]

export function TimeTracker({
    currentRotation,
    todayTimeRecord,
    onTimeRecordUpdate,
}: TimeTrackerProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [selectedActivities, setSelectedActivities] = useState<string[]>([])
    const [notes, setNotes] = useState("")
    const [currentTime, setCurrentTime] = useState(new Date())
    const [elapsedTime, setElapsedTime] = useState("00:00:00")
    const [_locationPermission, setLocationPermission] = useState<string>("prompt")
    const [optimisticRecord, setOptimisticRecord] = useState<typeof todayTimeRecord>(null)

    // Generate unique ID for notes field
    const notesId = useId()

    // Update current time every second
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    // Calculate elapsed time if clocked in
    useEffect(() => {
        const recordToUse = optimisticRecord || todayTimeRecord
        if (recordToUse?.clockIn && !recordToUse.clockOut) {
            const timer = setInterval(() => {
                const now = new Date()
                const clockInTime = new Date(recordToUse.clockIn)
                const diff = now.getTime() - clockInTime.getTime()
                const hours = Math.floor(diff / (1000 * 60 * 60))
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                const seconds = Math.floor((diff % (1000 * 60)) / 1000)
                setElapsedTime(
                    `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
                )
            }, 1000)
            return () => clearInterval(timer)
        }
    }, [todayTimeRecord, optimisticRecord])

    // Initialize form with existing data
    useEffect(() => {
        const recordToUse = optimisticRecord || todayTimeRecord
        if (recordToUse) {
            try {
                let activities = []
                try {
                    activities = JSON.parse(recordToUse.activities || "[]")
                } catch (error) {
                    console.error("Failed to parse activities:", error)
                    activities = []
                }
                setSelectedActivities(activities)
            } catch {
                setSelectedActivities([])
            }
            setNotes(recordToUse.notes || "")
        }
    }, [todayTimeRecord, optimisticRecord])

    const handleClockIn = async () => {
        if (!currentRotation || selectedActivities.length === 0) {
            toast.error("Please select at least one activity before clocking in")
            return
        }

        setIsLoading(true)

        // Optimistic update - create a temporary record
        const now = new Date()
        const optimisticNewRecord = {
            id: "temp-" + Date.now(),
            clockIn: now,
            clockOut: null,
            totalHours: "0",
            activities: JSON.stringify(selectedActivities),
            notes: notes || null,
            status: "PENDING",
        }
        setOptimisticRecord(optimisticNewRecord)

        try {
            const result = await clockIn(currentRotation.id, selectedActivities)
            if (result.success) {
                toast.success("Successfully clocked in!")
                // Update with actual record data
                if (result.timeRecord) {
                    setOptimisticRecord(result.timeRecord as any)
                    onTimeRecordUpdate?.(result.timeRecord)
                }
            } else {
                // Revert optimistic update on error
                setOptimisticRecord(null)
                toast.error(result.error || "Failed to clock in")
            }
        } catch (_error) {
            // Revert optimistic update on error
            setOptimisticRecord(null)
            toast.error("An error occurred while clocking in")
        } finally {
            setIsLoading(false)
        }
    }

    const handleClockOut = async () => {
        const activeRecord = optimisticRecord || todayTimeRecord
        if (!activeRecord) {
            toast.error("No active time record found")
            return
        }

        setIsLoading(true)

        // Optimistic update - mark as clocked out
        const now = new Date()
        const clockInTime = new Date(activeRecord.clockIn)
        const totalMilliseconds = now.getTime() - clockInTime.getTime()
        const totalHours = (totalMilliseconds / (1000 * 60 * 60)).toFixed(2)

        const optimisticUpdatedRecord = {
            ...activeRecord,
            clockOut: now,
            totalHours,
            notes: notes || activeRecord.notes,
            activities: JSON.stringify(selectedActivities),
        }
        setOptimisticRecord(optimisticUpdatedRecord)

        try {
            const result = await clockOut(activeRecord.id, notes)
            if (result.success) {
                toast.success("Successfully clocked out!")
                // Update with actual record data
                if (result.timeRecord) {
                    setOptimisticRecord(result.timeRecord as any)
                    onTimeRecordUpdate?.(result.timeRecord)
                }
            } else {
                // Revert optimistic update on error
                setOptimisticRecord(activeRecord)
                toast.error(result.error || "Failed to clock out")
            }
        } catch (_error) {
            // Revert optimistic update on error
            setOptimisticRecord(activeRecord)
            toast.error("An error occurred while clocking out")
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpdateRecord = async () => {
        const activeRecord = optimisticRecord || todayTimeRecord
        if (!activeRecord) return

        setIsLoading(true)

        // Optimistic update
        const optimisticUpdatedRecord = {
            ...activeRecord,
            activities: JSON.stringify(selectedActivities),
            notes: notes || activeRecord.notes,
        }
        setOptimisticRecord(optimisticUpdatedRecord)

        try {
            const result = await updateTimeRecord(activeRecord.id, {
                activities: selectedActivities,
                notes,
            })
            if (result.success) {
                toast.success("Time record updated successfully!")
                // Update with actual record data
                if (result.timeRecord) {
                    setOptimisticRecord(result.timeRecord as any)
                    onTimeRecordUpdate?.(result.timeRecord)
                }
            } else {
                // Revert optimistic update on error
                setOptimisticRecord(activeRecord)
                toast.error(result.error || "Failed to update time record")
            }
        } catch (_error) {
            // Revert optimistic update on error
            setOptimisticRecord(activeRecord)
            toast.error("An error occurred while updating the record")
        } finally {
            setIsLoading(false)
        }
    }

    const handleActivityToggle = (activity: string) => {
        setSelectedActivities((prev) =>
            prev.includes(activity) ? prev.filter((a) => a !== activity) : [...prev, activity]
        )
    }

    // Use optimistic record if available, otherwise use the actual record
    const displayRecord = optimisticRecord || todayTimeRecord
    const isClocked = displayRecord && !displayRecord.clockOut
    const isCompleted = displayRecord?.clockOut

    if (!currentRotation) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Time Tracker
                    </CardTitle>
                    <CardDescription>
                        No active rotation found. Please contact your administrator.
                    </CardDescription>
                </CardHeader>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Time Tracker
                </CardTitle>
                <CardDescription>
                    {currentRotation.specialty} at {currentRotation.clinicalSite.name}
                </CardDescription>
            </CardHeader>
            <CardContent className="gap-6">
                {/* Current Status */}
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                    <div>
                        <p className="font-medium text-muted-foreground text-sm">Current Time</p>
                        <p className="font-bold text-2xl">{currentTime.toLocaleTimeString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-medium text-muted-foreground text-sm">
                            {isClocked ? "Time Elapsed" : isCompleted ? "Total Hours" : "Status"}
                        </p>
                        <div className="flex items-center gap-2">
                            {isClocked && (
                                <>
                                    <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                                    <p className="font-bold text-2xl text-healthcare-green">{elapsedTime}</p>
                                </>
                            )}
                            {isCompleted && (
                                <>
                                    <CheckCircle className="h-5 w-5 text-healthcare-green" />
                                    <p className="font-bold text-2xl">{displayRecord.totalHours}h</p>
                                </>
                            )}
                            {!displayRecord && (
                                <>
                                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                                    <p className="font-medium text-muted-foreground text-lg">Not Started</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status Badge */}
                {displayRecord && (
                    <div className="flex items-center gap-2">
                        <Badge
                            variant={
                                displayRecord.status === "APPROVED"
                                    ? "default"
                                    : displayRecord.status === "PENDING"
                                        ? "secondary"
                                        : "destructive"
                            }
                        >
                            {displayRecord.status}
                        </Badge>
                        {displayRecord.clockIn && (
                            <span className="text-muted-foreground text-sm">
                                Clocked in at {new Date(displayRecord.clockIn).toLocaleTimeString()}
                            </span>
                        )}
                        {displayRecord.clockOut && (
                            <span className="text-muted-foreground text-sm">
                                Clocked out at {new Date(displayRecord.clockOut).toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                )}

                {/* Activities Selection */}
                <div className="gap-3">
                    <Label className="font-medium text-base">Clinical Activities</Label>
                    <div className="grid grid-cols-2 gap-2">
                        {ACTIVITY_OPTIONS.map((activity) => (
                            <div key={activity} className="flex items-center gap-2">
                                <Checkbox
                                    id={activity}
                                    checked={selectedActivities.includes(activity)}
                                    onCheckedChange={() => handleActivityToggle(activity)}
                                    disabled={!!isCompleted}
                                />
                                <Label htmlFor={activity} className="cursor-pointer text-sm">
                                    {activity}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Notes */}
                <div className="gap-2">
                    <Label htmlFor={notesId} className="font-medium text-base">
                        Notes (Optional)
                    </Label>
                    <Textarea
                        id={notesId}
                        placeholder="Add any notes about your clinical experience today..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        disabled={!!isCompleted}
                        rows={3}
                    />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                    {!displayRecord && (
                        <Button
                            onClick={handleClockIn}
                            disabled={isLoading || selectedActivities.length === 0}
                            className="flex-1"
                        >
                            <Play className="mr-2 h-4 w-4" />
                            {isLoading ? "Clocking In..." : "Clock In"}
                        </Button>
                    )}

                    {isClocked && (
                        <>
                            <Button onClick={handleUpdateRecord} disabled={isLoading} variant="outline" className="flex-1">
                                {isLoading ? "Updating..." : "Update Record"}
                            </Button>
                            <Button onClick={handleClockOut} disabled={isLoading} className="flex-1">
                                <Square className="mr-2 h-4 w-4" />
                                {isLoading ? "Clocking Out..." : "Clock Out"}
                            </Button>
                        </>
                    )}

                    {isCompleted && (
                        <div className="flex-1 py-2 text-center">
                            <p className="text-muted-foreground text-sm">Time tracking completed for today</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}