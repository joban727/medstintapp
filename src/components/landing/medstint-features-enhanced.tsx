"use client"

import {
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  CheckCircle,
  Clock,
  FileText,
  Shield,
  Smartphone,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const coreFeatures = [
  {
    id: "rotations",
    title: "Clinical Rotation Management",
    description: "Comprehensive scheduling and tracking system for clinical rotations",
    icon: Clock,
    color: "blue",
    features: [
      "Automated scheduling and assignments",
      "Real-time rotation tracking",
      "Site capacity management",
      "Conflict resolution system",
    ],
    benefits: [
      "Reduce administrative overhead by 75%",
      "Eliminate scheduling conflicts",
      "Improve student satisfaction",
      "Optimize site utilization",
    ],
  },
  {
    id: "assessment",
    title: "Competency Assessment",
    description: "Evidence-based competency evaluation and tracking system",
    icon: Award,
    color: "green",
    features: [
      "Skills validation workflows",
      "Performance analytics",
      "Progress milestone tracking",
      "Competency portfolio management",
    ],
    benefits: [
      "Ensure clinical competency standards",
      "Track student progress objectively",
      "Generate comprehensive reports",
    ],
  },
  {
    id: "reporting",
    title: "Analytics & Reporting",
    description: "Advanced analytics and compliance reporting capabilities",
    icon: BarChart3,
    color: "amber",
    features: [
      "Real-time performance dashboards",
      "Compliance reporting automation",
      "Predictive analytics",
      "Custom report generation",
    ],
    benefits: [
      "Make data-driven decisions",
      "Ensure regulatory compliance",
      "Identify improvement opportunities",
      "Demonstrate program effectiveness",
    ],
  },
  {
    id: "security",
    title: "Security & Compliance",
    description: "Enterprise-grade security with data protection",
    icon: Shield,
    color: "orange",
    features: [
      "Secure data protection",
      "Role-based access control",
      "Audit trail and logging",
      "Encrypted data transmission",
    ],
    benefits: [
      "Protect sensitive student data",
      "Meet security requirements",
      "Maintain audit compliance",
      "Ensure data integrity",
    ],
  },
]

const additionalFeatures = [
  {
    icon: Zap,
    title: "Real-time Notifications",
    description: "Instant alerts for important events and deadlines",
  },
  {
    icon: Smartphone,
    title: "Mobile Access",
    description: "Full functionality on any device, anywhere",
  },
  {
    icon: Bell,
    title: "Automated Reminders",
    description: "Smart notifications to keep everyone on track",
  },
  {
    icon: FileText,
    title: "Document Management",
    description: "Centralized storage for all educational documents",
  },
  {
    icon: Users,
    title: "Collaboration Tools",
    description: "Enhanced communication between students and faculty",
  },
  {
    icon: TrendingUp,
    title: "Performance Insights",
    description: "Actionable insights to improve educational outcomes",
  },
]

const getColorClasses = (color: string) => {
  const colorMap = {
    blue: {
      bg: "bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950 dark:to-teal-950",
      icon: "text-cyan-600 dark:text-cyan-400",
      badge:
        "bg-gradient-to-r from-cyan-100 to-teal-100 text-cyan-800 dark:from-cyan-900 dark:to-teal-900 dark:text-cyan-300",
      border: "border-cyan-200 dark:border-cyan-800",
      gradient: "from-cyan-600 to-teal-600",
    },
    green: {
      bg: "bg-gradient-to-br from-emerald-50 to-cyan-50 dark:from-emerald-950 dark:to-cyan-950",
      icon: "text-emerald-600 dark:text-emerald-400",
      badge:
        "bg-gradient-to-r from-emerald-100 to-cyan-100 text-emerald-800 dark:from-emerald-900 dark:to-cyan-900 dark:text-emerald-300",
      border: "border-emerald-200 dark:border-emerald-800",
      gradient: "from-emerald-600 to-cyan-600",
    },
    orange: {
      bg: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950",
      icon: "text-amber-600 dark:text-amber-400",
      badge:
        "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 dark:from-amber-900 dark:to-orange-900 dark:text-amber-300",
      border: "border-amber-200 dark:border-amber-800",
      gradient: "from-amber-600 to-orange-600",
    },
    amber: {
      bg: "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950 dark:to-amber-950",
      icon: "text-orange-600 dark:text-orange-400",
      badge:
        "bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 dark:from-orange-900 dark:to-amber-900 dark:text-orange-300",
      border: "border-orange-200 dark:border-orange-800",
      gradient: "from-orange-600 to-amber-600",
    },
  }
  return colorMap[color as keyof typeof colorMap] || colorMap.blue
}

export const MedStintFeaturesEnhanced = () => {
  const [activeTab, setActiveTab] = useState("rotations")

  return (
    <section className="bg-white py-20 lg:py-32 dark:bg-slate-900">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="mb-16 text-center">
            <Badge className="mb-4 bg-gradient-to-r from-cyan-100 to-teal-100 text-cyan-800 dark:from-cyan-900 dark:to-teal-900 dark:text-cyan-300">
              Comprehensive Platform
            </Badge>
            <h2 className="mb-4 font-bold text-3xl text-slate-900 tracking-tight sm:text-4xl lg:text-5xl dark:text-white">
              Everything You Need for{" "}
              <span className="bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">
                Clinical Education
              </span>
            </h2>
            <p className="mx-auto max-w-3xl text-slate-600 text-xl dark:text-slate-300">
              A complete solution that streamlines medical education management with powerful tools
              designed for modern healthcare training programs.
            </p>
          </div>

          {/* Main Features Tabs */}
          <div className="mb-16">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-8 grid w-full grid-cols-2 lg:grid-cols-4">
                {coreFeatures.map((feature) => (
                  <TabsTrigger
                    key={feature.id}
                    value={feature.id}
                    className="flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-teal-600 data-[state=active]:text-white border border-slate-200 dark:border-slate-700 hover:bg-cyan-50 transition-colors duration-200 dark:hover:bg-cyan-900/20"
                  >
                    <feature.icon className="h-4 w-4" />
                    {feature.title.split(" ")[0]}
                  </TabsTrigger>
                ))}
              </TabsList>

              {coreFeatures.map((feature) => {
                const colors = getColorClasses(feature.color)
                return (
                  <TabsContent key={feature.id} value={feature.id} className="mt-0">
                    <Card className="border-0 shadow-xl">
                      <CardContent className="p-8">
                        <div className="grid items-center gap-8 lg:grid-cols-2">
                          <div className="space-y-6">
                            <div className="flex items-center gap-4">
                              <div
                                className={`flex h-12 w-12 items-center justify-center rounded-lg ${colors.bg}`}
                              >
                                <feature.icon className={`h-6 w-6 ${colors.icon}`} />
                              </div>
                              <div>
                                <h3 className="font-bold text-2xl text-slate-900 dark:text-white">
                                  {feature.title}
                                </h3>
                                <p className="text-slate-600 dark:text-slate-300">
                                  {feature.description}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <h4 className="mb-3 font-semibold text-slate-700 dark:text-slate-300">
                                  Key Features
                                </h4>
                                <ul className="space-y-2">
                                  {feature.features.map((item, index) => (
                                    <li
                                      key={`feature-${item.slice(0, 20)}-${index}`}
                                      className="flex items-center gap-2"
                                    >
                                      <CheckCircle
                                        className={`h-4 w-4 ${colors.icon} flex-shrink-0`}
                                      />
                                      <span className="text-slate-600 dark:text-slate-300">
                                        {item}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <div>
                                <h4 className="mb-3 font-semibold text-slate-700 dark:text-slate-300">
                                  Benefits
                                </h4>
                                <ul className="space-y-2">
                                  {feature.benefits.map((item, index) => (
                                    <li
                                      key={`benefit-${item.slice(0, 20)}-${index}`}
                                      className="flex items-center gap-2"
                                    >
                                      <div
                                        className={`h-2 w-2 rounded-full bg-gradient-to-r ${colors.gradient}`}
                                      />
                                      <span className="text-slate-600 dark:text-slate-300">
                                        {item}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <Button
                              className={`bg-gradient-to-r ${colors.gradient} text-white hover:opacity-90`}
                            >
                              Learn More
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                          </div>

                          <div className="relative">
                            <div
                              className={`absolute inset-0 rounded-xl bg-gradient-to-br ${colors.gradient} opacity-10 blur-3xl`}
                            />
                            <div className="relative rounded-xl bg-slate-50 p-6 dark:bg-slate-800">
                              <div className="space-y-4">
                                <div className="h-4 w-32 rounded-md bg-slate-200 dark:bg-slate-700" />
                                <div className="space-y-2">
                                  <div className="h-3 w-full rounded-md bg-slate-200 dark:bg-slate-700" />
                                  <div className="h-3 w-4/5 rounded-md bg-slate-200 dark:bg-slate-700" />
                                  <div className="h-3 w-3/5 rounded-md bg-slate-200 dark:bg-slate-700" />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-4">
                                  <div className={`rounded-lg ${colors.bg} p-4`}>
                                    <div className="mb-2 h-8 w-8 rounded-md bg-slate-200 dark:bg-slate-700" />
                                    <div className="mb-1 h-3 w-full rounded-md bg-slate-200 dark:bg-slate-700" />
                                    <div className="h-2 w-3/4 rounded-md bg-slate-200 dark:bg-slate-700" />
                                  </div>
                                  <div className={`rounded-lg ${colors.bg} p-4`}>
                                    <div className="mb-2 h-8 w-8 rounded-md bg-slate-200 dark:bg-slate-700" />
                                    <div className="mb-1 h-3 w-full rounded-md bg-slate-200 dark:bg-slate-700" />
                                    <div className="h-2 w-3/4 rounded-md bg-slate-200 dark:bg-slate-700" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )
              })}
            </Tabs>
          </div>

          {/* Additional Features Grid */}
          <div className="mb-16">
            <div className="mb-12 text-center">
              <h3 className="mb-4 font-bold text-2xl text-slate-900 dark:text-white">
                Additional Capabilities
              </h3>
              <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-300">
                More features to enhance your clinical education management experience.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {additionalFeatures.map((feature, index) => (
                <Card
                  key={`additional-feature-${feature.title.replace(/\s+/g, "-").toLowerCase()}-${index}`}
                  className="group hover:-translate-y-1 border-slate-200 transition-all duration-300 hover:shadow-lg dark:border-slate-700"
                >
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-r from-cyan-100 to-teal-100 transition-all duration-300 group-hover:from-cyan-200 group-hover:to-teal-200 dark:from-cyan-900 dark:to-teal-900 group-hover:dark:from-cyan-800 group-hover:dark:to-teal-800">
                      <feature.icon className="h-6 w-6 text-cyan-600 transition-colors duration-200 group-hover:text-cyan-700 dark:text-cyan-400 group-hover:dark:text-cyan-300" />
                    </div>
                    <h4 className="mb-2 font-semibold text-slate-900 dark:text-white">
                      {feature.title}
                    </h4>
                    <p className="text-slate-600 text-sm dark:text-slate-300">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* CTA Section */}
          <div className="rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 p-8 text-center text-white lg:p-12">
            <h3 className="mb-4 font-bold text-3xl">Ready to Transform Your Clinical Education?</h3>
            <p className="mx-auto mb-8 max-w-2xl text-cyan-100">
              Join hundreds of medical institutions already using MedStint to streamline their
              clinical education programs.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="bg-white font-semibold text-cyan-600 hover:bg-cyan-50">
                Start Free Trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white font-semibold text-white hover:bg-white/10"
              >
                Schedule Demo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
