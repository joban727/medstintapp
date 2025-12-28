import { eq, or } from "drizzle-orm"
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit,
  Filter,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Trash2,
  Users,
  Video,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "../../../../components/ui/avatar"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs"
import { db } from "@/database/connection-pool"
import { rotations, users, meetings, assessments, evaluations } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function PreceptorSchedulePage() {
  const user = await requireAnyRole(["CLINICAL_PRECEPTOR"], "/dashboard")

  // Fetch rotations for this preceptor
  const preceptorRotations = await db
    .select({
      id: rotations.id,
      title: rotations.specialty,
      startDate: rotations.startDate,
      endDate: rotations.endDate,
      status: rotations.status,
      studentId: rotations.studentId,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(rotations)
    .leftJoin(users, eq(rotations.studentId, users.id))
    .where(eq(rotations.preceptorId, user.id))
    .orderBy(rotations.startDate)

  // Fetch meetings
  const meetingsData = await db
    .select({
      id: meetings.id,
      title: meetings.title,
      startTime: meetings.startTime,
      endTime: meetings.endTime,
      type: meetings.type,
      location: meetings.location,
      status: meetings.status,
      studentId: meetings.studentId,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(meetings)
    .leftJoin(users, eq(meetings.studentId, users.id))
    .where(eq(meetings.organizerId, user.id))

  // Fetch assessments
  const assessmentsData = await db
    .select({
      id: assessments.id,
      date: assessments.date,
      type: assessments.type,
      studentId: assessments.studentId,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(assessments)
    .leftJoin(users, eq(assessments.studentId, users.id))
    .where(eq(assessments.assessorId, user.id))

  // Fetch evaluations
  const evaluationsData = await db
    .select({
      id: evaluations.id,
      date: evaluations.observationDate,
      type: evaluations.type,
      studentId: evaluations.studentId,
      studentName: users.name,
      studentEmail: users.email,
    })
    .from(evaluations)
    .leftJoin(users, eq(evaluations.studentId, users.id))
    .where(eq(evaluations.evaluatorId, user.id))

  // Combine into unified events
  const scheduleEvents = [
    ...meetingsData.map(m => ({
      id: m.id,
      title: m.title,
      start: m.startTime,
      end: m.endTime,
      date: m.startTime,
      time: m.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: (m.endTime.getTime() - m.startTime.getTime()) / (1000 * 60),
      type: 'meeting',
      status: m.status.toLowerCase(),
      location: m.location || 'Virtual',
      studentName: m.studentName,
      studentEmail: m.studentEmail,
      meetingType: m.type === 'VIRTUAL' ? 'virtual' : 'in-person',
      priority: 'medium'
    })),
    ...assessmentsData.map(a => ({
      id: a.id,
      title: `Assessment: ${a.type}`,
      start: a.date,
      end: new Date(a.date.getTime() + 60 * 60 * 1000), // Assume 1 hour
      date: a.date,
      time: a.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: 60,
      type: 'assessment',
      status: 'confirmed',
      location: 'Clinical Site',
      studentName: a.studentName,
      studentEmail: a.studentEmail,
      meetingType: 'in-person',
      priority: 'high'
    })),
    ...evaluationsData.map(e => ({
      id: e.id,
      title: `Evaluation: ${e.type || 'General'}`,
      start: e.date,
      end: new Date(e.date.getTime() + 30 * 60 * 1000), // Assume 30 mins
      date: e.date,
      time: e.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      duration: 30,
      type: 'evaluation',
      status: 'confirmed',
      location: 'Clinical Site',
      studentName: e.studentName,
      studentEmail: e.studentEmail,
      meetingType: 'in-person',
      priority: 'medium'
    }))
  ]

  const currentDate = new Date()
  const currentWeek = getWeekDates(currentDate)

  const todayEvents = scheduleEvents.filter(
    (event) => event.date.toDateString() === currentDate.toDateString()
  )

  const upcomingEvents = scheduleEvents.filter((event) => event.date > currentDate).sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 5)

  const typeColors = {
    meeting: "bg-blue-100 text-blue-800",
    orientation: "bg-blue-100 text-blue-800",
    "check-in": "bg-green-100 text-green-800",
    evaluation: "bg-orange-100 text-orange-800",
    assessment: "bg-red-100 text-red-800",
    group: "bg-purple-100 text-purple-800",
  }

  const statusColors = {
    confirmed: "bg-green-100 text-green-800",
    scheduled: "bg-green-100 text-green-800",
    completed: "bg-gray-100 text-gray-800",
    pending: "bg-yellow-100 text-yellow-800",
    cancelled: "bg-red-100 text-red-800",
  }

  function getWeekDates(date: Date) {
    const week = []
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek)
      day.setDate(startOfWeek.getDate() + i)
      week.push(day)
    }
    return week
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Schedule &amp; Calendar</h1>
          <p className="text-muted-foreground">
            Manage your teaching schedule, student meetings, and evaluations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Calendar
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Schedule Meeting
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Today's Events</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{todayEvents.length}</div>
            <p className="text-muted-foreground text-xs">
              {todayEvents.filter((e) => e.status === "confirmed" || e.status === "scheduled").length} confirmed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{scheduleEvents.length}</div>
            <p className="text-muted-foreground text-xs">
              {scheduleEvents.reduce((sum, e) => sum + e.duration, 0)} total minutes
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {
                new Set(scheduleEvents.filter((e) => e.studentEmail).map((e) => e.studentEmail))
                  .size
              }
            </div>
            <p className="text-muted-foreground text-xs">Active this week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Evaluations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {
                scheduleEvents.filter((e) => e.type === "evaluation" || e.type === "assessment")
                  .length
              }
            </div>
            <p className="text-muted-foreground text-xs">Due this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Management */}
      <Tabs defaultValue="week" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="week">Week View</TabsTrigger>
            <TabsTrigger value="day">Day View</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="students">Student Schedule</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 font-medium text-sm">
              {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <Button variant="outline" size="sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </div>
        </div>

        <TabsContent value="week" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
              <CardDescription>Your complete weekly teaching and meeting schedule</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-8 gap-4">
                {/* Time column */}
                <div className="space-y-4">
                  <div className="h-12" /> {/* Header spacer */}
                  {Array.from({ length: 12 }, (_, i) => (
                    <div
                      key={`time-slot-${8 + i}-${i}`}
                      className="h-16 border-t pt-1 text-muted-foreground text-sm"
                    >
                      {String(8 + i).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {currentWeek.map((day, dayIndex) => (
                  <div
                    key={`day-${day.toISOString().split("T")[0]}-${dayIndex}`}
                    className="space-y-1"
                  >
                    <div className="h-12 border-b pb-2 text-center">
                      <div className="font-medium text-sm">
                        {day.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div
                        className={`font-bold text-lg ${day.toDateString() === currentDate.toDateString()
                            ? "mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600"
                            : ""
                          }`}
                      >
                        {day.getDate()}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {scheduleEvents
                        .filter((event) => event.date.toDateString() === day.toDateString())
                        .map((event) => {
                          const timeSlot = Number.parseInt(event.time.split(":")[0]) - 8
                          return (
                            <div
                              key={event.id}
                              className="cursor-pointer rounded border border-blue-200 bg-blue-50 p-2 text-xs hover:bg-blue-100"
                              style={{
                                marginTop: `${timeSlot * 4}rem`,
                                height: `${(event.duration / 60) * 4}rem`,
                                minHeight: "2rem",
                              }}
                            >
                              <div className="truncate font-medium text-blue-900">
                                {event.title}
                              </div>
                              <div className="text-blue-700">
                                {event.time} ({event.duration}m)
                              </div>
                              <div className="mt-1 flex items-center gap-1">
                                {event.meetingType === "virtual" ? (
                                  <Video className="h-3 w-3" />
                                ) : (
                                  <MapPin className="h-3 w-3" />
                                )}
                                <span className="truncate">{event.location}</span>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="day" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Schedule - {currentDate.toLocaleDateString()}</CardTitle>
              <CardDescription>Detailed view of today's meetings and activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {todayEvents.length > 0 ? (
                  todayEvents.map((event) => (
                    <div key={event.id} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                            <Clock className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-medium">{event.title}</div>
                            <div className="text-muted-foreground text-sm">
                              {event.time} - {event.duration} minutes
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={typeColors[event.type as keyof typeof typeColors] || "bg-gray-100"}>
                            {event.type.toUpperCase()}
                          </Badge>
                          <Badge
                            className={statusColors[event.status as keyof typeof statusColors] || "bg-gray-100"}
                          >
                            {event.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Student:</span> {event.studentName}
                        </div>
                        <div>
                          <span className="font-medium">Location:</span> {event.location}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span>
                          {event.meetingType === "virtual" ? (
                            <span className="ml-1 inline-flex items-center">
                              <Video className="mr-1 h-4 w-4" /> Virtual
                            </span>
                          ) : (
                            <span className="ml-1 inline-flex items-center">
                              <MapPin className="mr-1 h-4 w-4" /> In-Person
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="font-medium">Priority:</span> {event.priority}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline">
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline">
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Message Student
                        </Button>
                        {event.meetingType === "virtual" && (
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                            <Video className="mr-2 h-4 w-4" />
                            Join Meeting
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>No events scheduled for today</p>
                    <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                      <Plus className="mr-2 h-4 w-4" />
                      Schedule Meeting
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Events</CardTitle>
              <CardDescription>Your next scheduled meetings and activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={`https://avatar.vercel.sh/${event.studentEmail}`} />
                        <AvatarFallback>
                          {event.studentName?.charAt(0)?.toUpperCase() || "S"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{event.title}</div>
                        <div className="text-muted-foreground text-sm">
                          {event.date.toLocaleDateString()} at {event.time} • {event.duration}m
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge
                            className={typeColors[event.type as keyof typeof typeColors] || "bg-gray-100"}
                            variant="outline"
                          >
                            {event.type}
                          </Badge>
                          {event.meetingType === "virtual" ? (
                            <Video className="h-4 w-4 text-blue-500" />
                          ) : (
                            <MapPin className="h-4 w-4 text-green-500" />
                          )}
                          <span className="text-muted-foreground text-xs">{event.location}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[event.status as keyof typeof statusColors] || "bg-gray-100"}>
                        {event.status}
                      </Badge>
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Student Schedules</CardTitle>
              <CardDescription>
                Overview of all your students' rotation schedules and availability
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {preceptorRotations.map((rotation) => (
                  <div key={rotation.id} className="rounded-lg border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={`https://avatar.vercel.sh/${rotation.studentEmail}`} />
                          <AvatarFallback>
                            {rotation.studentName?.charAt(0)?.toUpperCase() || "S"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{rotation.studentName}</div>
                          <div className="text-muted-foreground text-sm">{rotation.title}</div>
                        </div>
                      </div>
                      <Badge
                        className={
                          rotation.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : rotation.status === "SCHEDULED"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                        }
                      >
                        {rotation.status?.replace("_", " ")}
                      </Badge>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Start Date:</span>{" "}
                        {rotation.startDate?.toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">End Date:</span>{" "}
                        {rotation.endDate?.toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline">
                        <Calendar className="mr-2 h-4 w-4" />
                        Schedule Meeting
                      </Button>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Send Message
                      </Button>
                      <Button size="sm" variant="outline">
                        <Phone className="mr-2 h-4 w-4" />
                        Call Student
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
