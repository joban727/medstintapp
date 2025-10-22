"use client"

import { Award, CheckCircle, Clock, Globe, School, Target, TrendingUp, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

const platformStats = [
  {
    icon: School,
    value: "50+",
    label: "Medical Institutions",
    description: "Advanced medical education programs",
    color: "blue",
    growth: "+25% this year",
  },
  {
    icon: Clock,
    value: "99.9%",
    label: "Platform Uptime",
    description: "Reliable platform access",
    color: "blue",
    growth: "24/7 monitoring",
  },
]

const performanceMetrics = [
  {
    label: "Administrative Efficiency",
    value: 85,
    color: "blue",
    description: "Reduction in manual tasks",
  },
  {
    label: "Student Satisfaction",
    value: 94,
    color: "green",
    description: "Based on user surveys",
  },
  {
    label: "Compliance Rate",
    value: 98,
    color: "green",
    description: "Accreditation requirements met",
  },
  {
    label: "Data Accuracy",
    value: 99,
    color: "orange",
    description: "Automated validation systems",
  },
]

const achievements = [
  {
    icon: CheckCircle,
    title: "Reliable Platform",
    description: "Built with modern technology for stability and performance",
    metric: "99.9% uptime",
  },
  {
    icon: Award,
    title: "User-Focused Design",
    description: "Intuitive interface designed for medical education workflows",
    metric: "4.8/5 rating",
  },
  {
    icon: TrendingUp,
    title: "Streamlined Processes",
    description: "Simplified administrative tasks and improved efficiency",
    metric: "75% time saved",
  },
  {
    icon: Globe,
    title: "Scalable Solution",
    description: "Grows with your institution's needs and requirements",
    metric: "Unlimited users",
  },
  {
    icon: Target,
    title: "Accurate Tracking",
    description: "Precise monitoring of student progress and performance",
    metric: "Real-time data",
  },
  {
    icon: Zap,
    title: "Fast Implementation",
    description: "Quick setup and onboarding for immediate productivity",
    metric: "2-week deployment",
  },
]

const getColorClasses = (color: string) => {
  const colorMap = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950",
      icon: "text-blue-600 dark:text-blue-400",
      text: "text-blue-600 dark:text-blue-400",
      gradient: "from-blue-600 to-blue-700",
      progress: "bg-blue-600",
    },
    green: {
      bg: "bg-green-50 dark:bg-green-950",
      icon: "text-green-600 dark:text-green-400",
      text: "text-green-600 dark:text-green-400",
      gradient: "from-green-600 to-green-700",
      progress: "bg-green-600",
    },
    orange: {
      bg: "bg-orange-50 dark:bg-orange-950",
      icon: "text-orange-600 dark:text-orange-400",
      text: "text-orange-600 dark:text-orange-400",
      gradient: "from-orange-600 to-orange-700",
      progress: "bg-orange-600",
    },
  }
  return colorMap[color as keyof typeof colorMap] || colorMap.blue
}

export const MedStintStatsEnhanced = () => {
  const [_animatedValues, setAnimatedValues] = useState({
    institutions: 0,
    rotations: 0,
    satisfaction: 0,
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValues({
        institutions: 500,
        rotations: 120,
        satisfaction: 98,
      })
    }, 500)

    return () => clearTimeout(timer)
  }, [])

  return (
    <section className="bg-gradient-to-br from-slate-50 to-blue-50 py-20 lg:py-32 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl">
          {/* Main Stats Grid */}
          <div className="mb-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {platformStats.map((stat, _index) => {
              const colors = getColorClasses(stat.color)
              const IconComponent = stat.icon

              return (
                <Card
                  key={`stat-${stat.label.replace(/\s+/g, "-").toLowerCase()}`}
                  className="group hover:-translate-y-1 relative overflow-hidden border-0 shadow-xl transition-all duration-300 hover:shadow-2xl"
                >
                  <CardContent className="p-6 text-center">
                    {/* Icon */}
                    <div
                      className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${colors.bg}`}
                    >
                      <IconComponent className={`h-8 w-8 ${colors.icon}`} />
                    </div>

                    {/* Value with Animation */}
                    <div className="mb-2 font-bold text-4xl text-slate-900 dark:text-white">
                      {stat.value}
                    </div>

                    {/* Label */}
                    <div className="mb-2 font-semibold text-lg text-slate-700 dark:text-slate-300">
                      {stat.label}
                    </div>

                    {/* Description */}
                    <div className="mb-3 text-slate-500 text-sm dark:text-slate-400">
                      {stat.description}
                    </div>

                    {/* Growth Indicator */}
                    <Badge className={`${colors.bg} ${colors.text} border-0 font-medium text-xs`}>
                      {stat.growth}
                    </Badge>
                  </CardContent>

                  {/* Hover Effect */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${colors.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-5`}
                  />
                </Card>
              )
            })}
          </div>

          {/* Performance Metrics */}
          <div className="mb-16 rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-800">
            <div className="mb-8 text-center">
              <h3 className="mb-4 font-bold text-2xl text-slate-900 dark:text-white">
                Platform Performance
              </h3>
              <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-300">
                Consistent excellence in key performance indicators that matter most to our users.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
              {performanceMetrics.map((metric, _index) => {
                const colors = getColorClasses(metric.color)
                return (
                  <div key={`metric-${metric.label.replace(/\s+/g, "-").toLowerCase()}`} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {metric.value}%
                        </div>
                        <div className="text-slate-600 text-sm dark:text-slate-400">
                          {metric.label}
                        </div>
                      </div>
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full ${colors.bg}`}
                      >
                        <Target className={`h-5 w-5 ${colors.icon}`} />
                      </div>
                    </div>
                    <Progress value={metric.value} className={`h-2 ${colors.progress}`} />
                    <p className="text-slate-500 text-xs dark:text-slate-400">
                      {metric.description}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Achievements Section */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-white p-8 dark:from-slate-800 dark:to-slate-900">
            <div className="mb-12 text-center">
              <h3 className="mb-4 font-bold text-2xl text-slate-900 dark:text-white">
                Why Institutions Choose MedStint
              </h3>
              <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-300">
                Our platform delivers exceptional value through innovative features and proven
                results.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {achievements.map((achievement, _index) => {
                const IconComponent = achievement.icon
                return (
                  <div
                    key={`achievement-${achievement.title.replace(/\s+/g, "-").toLowerCase()}`}
                    className="group hover:-translate-y-1 rounded-xl bg-white p-6 text-center shadow-lg transition-all duration-300 hover:shadow-xl dark:bg-slate-800"
                  >
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                      <IconComponent className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h4 className="mb-2 font-semibold text-lg text-slate-900 dark:text-white">
                      {achievement.title}
                    </h4>
                    <p className="mb-3 text-slate-600 text-sm dark:text-slate-400">
                      {achievement.description}
                    </p>
                    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                      {achievement.metric}
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>

          {/* CTA Section */}
          <div className="mt-16 text-center">
            <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-12 text-white shadow-2xl">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <h3 className="mb-6 font-bold text-4xl leading-tight">
                Ready to Transform Your Clinical Education?
              </h3>
              <p className="mx-auto mb-8 max-w-2xl text-blue-100 text-lg">
                Join thousands of medical institutions already using MedStint to streamline their clinical education programs.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button 
                  size="lg" 
                  className="bg-white font-bold text-blue-600 hover:bg-blue-50 px-8 py-6 text-lg shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105"
                >
                  Get Started Today
                  <TrendingUp className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 font-semibold text-white hover:bg-white/10 px-8 py-6 text-lg backdrop-blur-sm transition-all duration-300 hover:scale-105"
                >
                  Schedule Demo
                </Button>
              </div>
              <div className="mt-8 flex items-center justify-center gap-6 text-blue-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>Free Trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>24/7 Support</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>Quick Setup</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
