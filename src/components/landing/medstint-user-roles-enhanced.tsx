"use client"

import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Clock,
  GraduationCap,
  School,
  Shield,
  Stethoscope,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const userRoles = [
  {
    role: "CLINIC_ADMIN",
    title: "Clinic Administrator",
    description:
      "Oversee all student activities, clinical rotations, and compliance tracking across your clinic.",
    icon: School,
    color: "blue",
    responsibilities: [
      "Monitor student clinical hours",
      "Track rotation assignments",
      "Ensure compliance documentation",
      "Manage preceptor assignments",
    ],
    keyFeatures: [
      { icon: Users, text: "Real-time Activity Tracking", highlight: true },
      { icon: Clock, text: "Clinical Hours Monitoring", highlight: true },
      { icon: BarChart3, text: "Compliance Dashboard", highlight: true },
      { icon: Shield, text: "Audit Trail Management", highlight: false },
    ],
    stats: { students: "500+", tracking: "99.9%", efficiency: "3x" },
  },
  {
    role: "CLINICAL_PRECEPTOR",
    title: "Clinical Preceptor",
    description:
      "Track student performance, clinical activities, and provide real-time feedback during rotations.",
    icon: Stethoscope,
    color: "green",
    responsibilities: [
      "Track daily student activities",
      "Record clinical competencies",
      "Monitor patient interactions",
      "Provide real-time feedback",
    ],
    keyFeatures: [
      { icon: Users, text: "Student Activity Logging", highlight: true },
      { icon: ClipboardCheck, text: "Competency Assessment", highlight: true },
      { icon: TrendingUp, text: "Progress Monitoring", highlight: true },
      { icon: Clock, text: "Time Tracking Integration", highlight: false },
    ],
    stats: { activities: "50+/day", accuracy: "98%", timeSaved: "40%" },
  },
  {
    role: "CLINICAL_COORDINATOR",
    title: "Clinical Coordinator",
    description:
      "Coordinate student schedules, track rotation progress, and manage clinical site assignments.",
    icon: ClipboardCheck,
    color: "orange",
    responsibilities: [
      "Schedule student rotations",
      "Track site availability",
      "Monitor student progress",
      "Coordinate with multiple sites",
    ],
    keyFeatures: [
      { icon: ClipboardCheck, text: "Rotation Scheduling", highlight: true },
      { icon: BarChart3, text: "Multi-site Tracking", highlight: true },
      { icon: Award, text: "Progress Validation", highlight: true },
      { icon: Shield, text: "Site Compliance", highlight: false },
    ],
    stats: { rotations: "100+", sites: "15+", satisfaction: "95%" },
  },
  {
    role: "MEDICAL_STUDENT",
    title: "Medical Student",
    description:
      "Log clinical activities, track your progress, and manage your competency portfolio throughout rotations.",
    icon: GraduationCap,
    color: "indigo",
    responsibilities: [
      "Log daily clinical activities",
      "Track patient encounters",
      "Record procedure completions",
      "Submit competency evidence",
    ],
    keyFeatures: [
      { icon: Clock, text: "Activity Time Tracking", highlight: true },
      { icon: BarChart3, text: "Personal Progress Dashboard", highlight: true },
      { icon: BookOpen, text: "Digital Portfolio", highlight: false },
      { icon: Zap, text: "Instant Feedback", highlight: true },
    ],
    stats: { hours: "2,000+", encounters: "500+", completion: "95%" },
  },
]

const getColorClasses = (color: string) => {
  const colorMap = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950",
      icon: "text-medical-primary dark:text-blue-400",
      badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      border: "border-blue-200 dark:border-blue-800",
      gradient: "from-blue-600 to-blue-700",
      highlight: "bg-blue-500",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-950",
      icon: "text-healthcare-green dark:text-green-400",
      badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      border: "border-green-200 dark:border-green-800",
      gradient: "from-green-600 to-green-700",
      highlight: "bg-green-500",
    },
    orange: {
      bg: "bg-orange-50 dark:bg-orange-950",
      icon: "text-orange-600 dark:text-orange-400",
      badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
      border: "border-orange-200 dark:border-orange-800",
      gradient: "from-orange-600 to-orange-700",
      highlight: "bg-orange-500",
    },
    indigo: {
      bg: "bg-indigo-50 dark:bg-indigo-950",
      icon: "text-indigo-600 dark:text-indigo-400",
      badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
      border: "border-indigo-200 dark:border-indigo-800",
      gradient: "from-indigo-600 to-indigo-700",
      highlight: "bg-indigo-500",
    },
  }
  return colorMap[color as keyof typeof colorMap] || colorMap.blue
}

export const MedStintUserRolesEnhanced = () => {
  const [selectedRole, setSelectedRole] = useState(0)

  return (
    <section className="bg-slate-50 py-20 lg:py-32 dark:bg-slate-800">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="mb-16 text-center">
            <Badge className="mb-4 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
              Clinic Activity Tracking
            </Badge>
            <h2 className="mb-4 font-bold text-3xl text-slate-900 tracking-tight sm:text-4xl lg:text-5xl dark:text-white">
              Track Student{" "}
              <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                Clinic Activities
              </span>
            </h2>
            <p className="mx-auto max-w-3xl text-slate-600 text-xl dark:text-slate-300">
              Monitor student progress, clinical hours, and competency development in real-time with
              our comprehensive tracking system.
            </p>
          </div>

          {/* Role Selector */}
          <div className="mb-12 flex flex-wrap justify-center gap-4">
            {userRoles.map((role, index) => {
              const colors = getColorClasses(role.color)
              const IconComponent = role.icon
              return (
                <Button
                  key={role.role}
                  onClick={() => setSelectedRole(index)}
                  variant={selectedRole === index ? "default" : "outline"}
                  className={`flex items-center gap-2 px-6 py-3 ${selectedRole === index
                    ? `bg-gradient-to-r ${colors.gradient} text-white`
                    : "border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
                    }`}
                >
                  <IconComponent
                    className={`h-4 w-4 ${selectedRole === index ? "text-white" : colors.icon}`}
                  />
                  {role.title}
                </Button>
              )
            })}
          </div>

          {/* Selected Role Details */}
          <div className="mb-16">
            {userRoles.map((role, index) => {
              if (index !== selectedRole) return null
              const colors = getColorClasses(role.color)
              const IconComponent = role.icon
              return (
                <Card
                  key={role.role}
                  className={`group relative overflow-hidden border-2 ${colors.border} transition-all duration-500 hover:shadow-2xl`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-5`}
                  />
                  <CardContent className="relative p-8">
                    <div className="grid gap-8 lg:grid-cols-2">
                      {/* Left Column - Role Info */}
                      <div className="gap-6">
                        <div className="flex items-center gap-4">
                          <div
                            className={`flex h-16 w-16 items-center justify-center rounded-xl ${colors.bg}`}
                          >
                            <IconComponent className={`h-8 w-8 ${colors.icon}`} />
                          </div>
                          <div>
                            <Badge className={`${colors.badge} mb-2 font-medium text-sm`}>
                              {role.role.replace("_", " ")}
                            </Badge>
                            <h3 className="font-bold text-2xl text-slate-900 dark:text-white">
                              {role.title}
                            </h3>
                          </div>
                        </div>
                        <p className="text-lg text-slate-600 leading-relaxed dark:text-slate-300">
                          {role.description}
                        </p>
                        <div>
                          <h4 className="mb-3 font-semibold text-slate-700 dark:text-slate-300">
                            Key Responsibilities
                          </h4>
                          <ul className="gap-2">
                            {role.responsibilities.map((item, index) => (
                              <li
                                key={`responsibility-${item.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}-${index}`}
                                className="flex items-center gap-3"
                              >
                                <div className={`h-2 w-2 rounded-full ${colors.highlight}`} />
                                <span className="text-slate-600 dark:text-slate-300">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Right Column - Features & Stats */}
                      <div className="gap-6">
                        <div>
                          <h4 className="mb-4 font-semibold text-slate-700 dark:text-slate-300">
                            Platform Features
                          </h4>
                          <div className="grid gap-3">
                            {role.keyFeatures.map((feature, index) => {
                              const FeatureIcon = feature.icon
                              return (
                                <div
                                  key={`feature-${feature.text.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}-${index}`}
                                  className={`flex items-center gap-3 rounded-lg p-3 transition-all duration-300 ${feature.highlight
                                    ? `${colors.bg} border-l-4 ${colors.border}`
                                    : "bg-slate-50 dark:bg-slate-800"
                                    }`}
                                >
                                  <FeatureIcon className={`h-5 w-5 ${colors.icon} flex-shrink-0`} />
                                  <span
                                    className={`font-medium ${feature.highlight
                                      ? "text-slate-900 dark:text-white"
                                      : "text-slate-600 dark:text-slate-300"
                                      }`}
                                  >
                                    {feature.text}
                                  </span>
                                  {feature.highlight && (
                                    <div
                                      className={`ml-auto h-2 w-2 rounded-full ${colors.highlight}`}
                                    />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        <div>
                          <h4 className="mb-4 font-semibold text-slate-700 dark:text-slate-300">
                            Performance Metrics
                          </h4>
                          <div className="grid grid-cols-3 gap-4">
                            {Object.entries(role.stats).map(([key, value]) => (
                              <div key={key} className={`rounded-lg p-4 text-center ${colors.bg}`}>
                                <div className="mb-1 font-bold text-2xl text-slate-900 dark:text-white">
                                  {value}
                                </div>

                                <div className="text-slate-600 text-xs capitalize dark:text-slate-400">
                                  {key.replace(/([A-Z])/g, " $1").trim()}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* All Roles Overview */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {userRoles.map((role, index) => {
              const colors = getColorClasses(role.color)
              const IconComponent = role.icon
              return (
                <div
                  key={role.role}
                  className="group relative overflow-hidden rounded-lg border bg-card p-6 transition-all duration-300 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${colors.bg}`}>
                        <IconComponent className={`h-5 w-5 ${colors.icon}`} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-card-foreground">{role.title}</h4>
                        <p className="text-muted-foreground text-sm">{role.description}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRole(index)}
                      className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    >
                      View Details
                    </Button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="rounded-lg bg-muted p-3">
                      <div className="font-semibold text-foreground">
                        {role.stats.students ||
                          role.stats.activities ||
                          role.stats.rotations ||
                          role.stats.hours}
                      </div>
                      <div className="text-muted-foreground">
                        {role.stats.students
                          ? "Students Tracked"
                          : role.stats.activities
                            ? "Daily Activities"
                            : role.stats.rotations
                              ? "Rotations Managed"
                              : "Clinical Hours"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <div className="font-semibold text-foreground">
                        {role.stats.tracking ||
                          role.stats.accuracy ||
                          role.stats.sites ||
                          role.stats.encounters}
                      </div>
                      <div className="text-muted-foreground">
                        {role.stats.tracking
                          ? "Tracking Accuracy"
                          : role.stats.accuracy
                            ? "Assessment Accuracy"
                            : role.stats.sites
                              ? "Clinical Sites"
                              : "Patient Encounters"}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <p className="mb-6 text-slate-600 dark:text-slate-300">
              Experience how each role contributes to successful clinical education
            </p>
            <Button
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-green-600 text-white hover:from-blue-700 hover:to-green-700"
            >
              Explore Role-Based Features
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
