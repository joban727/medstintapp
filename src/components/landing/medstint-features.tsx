"use client"

import { Activity, Award, BarChart3, Calendar, CheckCircle, Clock, Shield, Users } from "lucide-react"
import { useId } from "react"
import { site } from "../../config/site"
import { Badge } from "../ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"

const features = [
  {
    icon: Calendar,
    title: "Clinical Rotation Management",
    description: site.features.clinicalRotations,
    details: "Schedule, track, and manage clinical rotations with automated assignments and real-time updates.",
    color: "blue",
    benefits: ["Automated scheduling", "Conflict resolution", "Site coordination"],
  },
  {
    icon: Clock,
    title: "Time Tracking & Logging",
    description: site.features.timeTracking,
    details: "Comprehensive time logging with approval workflows and automated compliance reporting.",
    color: "green",
    benefits: ["Digital timesheets", "Approval workflows", "Compliance tracking"],
  },
  {
    icon: Award,
    title: "Competency Assessment",
    description: site.features.competencyAssessment,
    details: "Track student progress with standardized competency evaluations and skills validation.",
    color: "purple",
    benefits: ["Skills tracking", "Progress monitoring", "Standardized assessments"],
  },
  {
    icon: BarChart3,
    title: "Real-time Reporting",
    description: site.features.reporting,
    details: "Generate comprehensive reports with real-time analytics and compliance documentation.",
    color: "orange",
    benefits: ["Custom dashboards", "Export capabilities", "Compliance reports"],
  },
  {
    icon: Shield,
    title: "HIPAA Compliance",
    description: site.features.hipaaCompliant,
    details: "Enterprise-grade security with full HIPAA compliance and data protection measures.",
    color: "red",
    benefits: ["Data encryption", "Access controls", "Audit trails"],
  },
  {
    icon: Users,
    title: "Multi-Role Management",
    description: "Comprehensive role-based access control for all stakeholders in medical education.",
    details: "Support for administrators, preceptors, supervisors, and students with tailored interfaces.",
    color: "indigo",
    benefits: ["Role-based access", "Custom permissions", "Tailored dashboards"],
  },
]

const getColorClasses = (color: string) => {
  const colorMap = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950",
      icon: "text-medical-primary dark:text-blue-400",
      badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-950",
      icon: "text-healthcare-green dark:text-green-400",
      badge: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-950",
      icon: "text-purple-600 dark:text-purple-400",
      badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
    },
    orange: {
      bg: "bg-orange-50 dark:bg-orange-950",
      icon: "text-orange-600 dark:text-orange-400",
      badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    },
    red: {
      bg: "bg-red-50 dark:bg-red-950",
      icon: "text-error dark:text-red-400",
      badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    },
    indigo: {
      bg: "bg-indigo-50 dark:bg-indigo-950",
      icon: "text-indigo-600 dark:text-indigo-400",
      badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
    },
  }
  return colorMap[color as keyof typeof colorMap] || colorMap.blue
}

export const MedStintFeaturesSection = () => {
  const sectionId = useId()

  return (
    <section id={`features-${sectionId}`} className="bg-white py-20 lg:py-32 dark:bg-slate-900">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="mb-16 text-center">
            <Badge className="mb-4 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
              Platform Features
            </Badge>
            <h2 className="mb-4 font-bold text-3xl text-slate-900 tracking-tight sm:text-4xl lg:text-5xl dark:text-white">
              Everything You Need for{" "}
              <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                Clinical Education
              </span>
            </h2>
            <p className="mx-auto max-w-3xl text-slate-600 text-xl dark:text-slate-300">
              Comprehensive tools designed specifically for medical education institutions to
              streamline operations and enhance student outcomes.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const colors = getColorClasses(feature.color)
              const IconComponent = feature.icon

              return (
                <Card
                  key={`feature-${feature.title.replace(/\s+/g, "-").toLowerCase()}-${index}`}
                  className="group hover:-translate-y-1 relative overflow-hidden border-0 shadow-lg transition-all duration-300 hover:shadow-xl"
                >
                  <CardHeader className="pb-4">
                    <div
                      className={`inline-flex h-12 w-12 items-center justify-center rounded-lg ${colors.bg} mb-4`}
                    >
                      <IconComponent className={`h-6 w-6 ${colors.icon}`} />
                    </div>
                    <CardTitle className="font-semibold text-slate-900 text-xl dark:text-white">
                      {feature.title}
                    </CardTitle>
                    <CardDescription className="text-slate-600 dark:text-slate-300">
                      {feature.details}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Benefits List */}
                    <div className="mb-4 gap-2">
                      {feature.benefits.map((benefit, benefitIndex) => (
                        <div
                          key={`benefit-${feature.title}-${benefitIndex}`}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4 flex-shrink-0 text-healthcare-green dark:text-green-400" />
                          <span className="text-slate-600 text-sm dark:text-slate-400">
                            {benefit}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Feature Badge */}
                    <Badge className={`${colors.badge} text-xs`}>Core Feature</Badge>
                  </CardContent>

                  {/* Hover Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-green-600/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </Card>
              )
            })}
          </div>

          {/* Bottom CTA */}
          <div className="mt-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 text-slate-500 text-sm dark:text-slate-400">
              <Activity className="h-4 w-4" />
              <span>Trusted by leading medical institutions</span>
            </div>
            <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-300">
              Join the growing community of medical schools and healthcare institutions using
              MedStint to transform their clinical education programs.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
