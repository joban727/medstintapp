"use client"

import {
  ArrowRight,
  Award,
  CheckCircle,
  ChevronRight,
  Clock,
  Play,
  Sparkles,
  Users,
  Heart,
  Shield,
  TrendingUp,
  Zap,
  Calendar,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useEffectEvent, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useTheme } from "next-themes"

const heroStats = [
  { icon: Users, value: "10,000+", label: "Students Tracked" },
  { icon: Clock, value: "99.9%", label: "Uptime" },
  { icon: Award, value: "24/7", label: "Support" },
]

const brandValues = [
  {
    icon: Shield,
    title: "Secure & Compliant",
    description: "HIPAA-compliant platform ensuring data security",
  },
  {
    icon: Heart,
    title: "Student-Centered",
    description: "Designed with student success as the top priority",
  },
  {
    icon: TrendingUp,
    title: "Performance Driven",
    description: "Data-driven insights for better outcomes",
  },
]

export const MedStintHeroEnhanced = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  // Stable event handler with useEffectEvent (React 19.2+)
  const onMouseMove = useEffectEvent((e: MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY })
  })

  useEffect(() => {
    setIsVisible(true)
    window.addEventListener("mousemove", onMouseMove)
    return () => window.removeEventListener("mousemove", onMouseMove)
  }, []) // No dependencies needed - onMouseMove always has fresh state

  return (
    <section className="relative min-h-[90vh] overflow-hidden bg-gradient-to-br from-cyan-50 via-teal-50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="-top-40 -right-40 absolute h-80 w-80 animate-pulse rounded-full bg-gradient-to-br from-cyan-400/30 to-teal-400/30 blur-3xl" />
        <div className="-bottom-40 -left-40 absolute h-80 w-80 animate-pulse rounded-full bg-gradient-to-br from-emerald-400/30 to-cyan-400/30 blur-3xl delay-1000" />
        <div
          className="absolute h-32 w-32 rounded-full bg-gradient-to-br from-white/20 to-transparent blur-2xl transition-transform duration-300 pointer-events-none"
          style={{
            left: mousePosition.x - 64,
            top: mousePosition.y - 64,
          }}
        />
      </div>

      <div className="container relative mx-auto px-4 pt-8 pb-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left Column - Content */}
            <div
              className={`gap-8 transition-all duration-1000 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                }`}
            >
              {/* Enhanced Logo Section */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                <Image
                  src="/logo-medstint.svg"
                  alt="MedStint Logo"
                  width={80}
                  height={80}
                  className="h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0"
                />
                <div>
                  <h2 className="font-bold text-3xl sm:text-4xl bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">
                    MedStint
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg font-medium">
                    Medical Education Management
                  </p>
                  <p className="text-cyan-600 dark:text-cyan-400 text-xs sm:text-sm font-semibold">
                    Empowering Healthcare Education Excellence
                  </p>
                </div>
              </div>

              {/* Brand Tagline */}
              <Badge className="mb-3 sm:mb-4 bg-gradient-to-r from-cyan-100 to-teal-100 text-cyan-800 dark:from-cyan-900 dark:to-teal-900 dark:text-cyan-300 text-xs sm:text-sm">
                ✨ Trusted by 500+ Medical Institutions
              </Badge>

              {/* Enhanced Badges */}
              <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-4 sm:mb-6">
                <Badge
                  variant="secondary"
                  className="bg-white/80 text-slate-700 shadow-sm dark:bg-slate-800/80 dark:text-slate-300 text-xs sm:text-sm"
                >
                  <Sparkles className="mr-1 h-3 w-3" />
                  AI-Powered
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-white/80 text-slate-700 shadow-sm dark:bg-slate-800/80 dark:text-slate-300 text-xs sm:text-sm"
                >
                  <Shield className="mr-1 h-3 w-3" />
                  HIPAA Compliant
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-white/80 text-slate-700 shadow-sm dark:bg-slate-800/80 dark:text-slate-300 text-xs sm:text-sm"
                >
                  <Award className="mr-1 h-3 w-3" />
                  4.9/5 Rating
                </Badge>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2 font-medium text-white shadow-lg">
                  <Sparkles className="mr-1 h-4 w-4" />
                  Next-Generation Platform
                </Badge>
                <Badge
                  variant="outline"
                  className="border-cyan-200 text-cyan-700 dark:border-cyan-800 dark:text-cyan-300"
                >
                  Enterprise Ready
                </Badge>
                <Badge
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                >
                  HIPAA Compliant
                </Badge>
              </div>

              {/* Enhanced Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-slate-900 dark:text-white">
                Transform Medical{" "}
                <span className="bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">
                  Education
                </span>
                <br className="hidden sm:block" />
                with Confidence
              </h1>

              <p className="text-slate-600 text-lg sm:text-xl lg:text-2xl dark:text-slate-300">
                Streamline clinical rotations, track student progress, and ensure competency
                compliance with our comprehensive platform designed for modern medical education.
              </p>

              {/* Brand Values */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                {brandValues.map((value, index) => (
                  <div key={index} className="flex items-center gap-1 sm:gap-2">
                    <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-gradient-to-r from-cyan-600 to-teal-600" />
                    <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">
                      {value.title}
                    </span>
                  </div>
                ))}
              </div>

              {/* Key Benefits */}
              <div className="gap-2 sm:gap-3">
                {[
                  "Advanced scheduling and rotation management",
                  "Real-time competency tracking and assessment",
                  "Comprehensive reporting and analytics dashboard",
                  "Secure communication and collaboration tools",
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start sm:items-center gap-2 sm:gap-3">
                    <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-gradient-to-r from-cyan-100 to-teal-100 dark:from-cyan-900 dark:to-teal-900 flex-shrink-0 mt-0.5 sm:mt-0">
                      <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <span className="text-sm sm:text-base text-slate-700 dark:text-slate-300">
                      {benefit}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <Button
                  asChild
                  size="default"
                  className="bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 text-sm sm:text-base"
                >
                  <Link href="/auth/sign-up">
                    <div className="flex items-center">
                      Start Free Trial
                      <ArrowRight className="ml-1 sm:ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                  </Link>
                </Button>
                <Button
                  asChild
                  size="default"
                  variant="outline"
                  className="border-slate-300 bg-white/80 text-slate-700 hover:bg-white transition-colors duration-200 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 text-sm sm:text-base"
                >
                  <Link href="/demo">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                      Watch Demo
                    </div>
                  </Link>
                </Button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
                {heroStats.map((stat, index) => {
                  const Icon = stat.icon
                  return (
                    <div
                      key={`hero-stat-${stat.label.replace(/\s+/g, "-").toLowerCase()}-${index}`}
                      className="rounded-lg bg-white/60 p-3 sm:p-4 text-center shadow-sm backdrop-blur-sm dark:bg-slate-800/60"
                    >
                      <div className="flex justify-center mb-1 sm:mb-2">
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                        {stat.value}
                      </div>
                      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        {stat.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Column - Visual */}
            <div
              className={`relative transition-all duration-1000 delay-300 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
                }`}
            >
              <div className="relative mx-auto max-w-2xl">
                {/* Floating Cards */}
                <div className="group -top-4 -left-4 absolute w-64 sm:w-72 rotate-[-8deg] transform transition-transform duration-200 hover:rotate-[-4deg] hover:scale-105">
                  <Card className="relative border-slate-200 bg-white/95 shadow-2xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95 border border-slate-200/50">
                    <CardContent className="p-4 sm:p-6">
                      <div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
                        <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-teal-500">
                          <Users className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">
                            Student Dashboard
                          </p>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            Live Preview
                          </p>
                        </div>
                      </div>
                      <div className="gap-2 sm:gap-3">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <div className="h-1.5 sm:h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                            <div className="h-1.5 sm:h-2 w-3/4 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500" />
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                            85%
                          </span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <div className="h-1.5 sm:h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                            <div className="h-1.5 sm:h-2 w-1/2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" />
                          </div>
                          <span className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                            50%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="group -bottom-4 sm:-bottom-4 -right-4 sm:-right-8 absolute w-64 sm:w-72 rotate-[8deg] transform transition-transform duration-200 hover:rotate-[4deg] hover:scale-105 opacity-90">
                  <Card className="relative border-slate-200 bg-white/95 shadow-2xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/95 border border-slate-200/50">
                    <CardContent className="p-4 sm:p-6">
                      <div className="mb-3 sm:mb-4 flex items-center gap-2 sm:gap-3">
                        <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500">
                          <Award className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm sm:text-base">
                            Competency Tracker
                          </p>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                            Real-time Updates
                          </p>
                        </div>
                      </div>
                      <div className="gap-2 sm:gap-3">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Patient Care</span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400 text-xs">
                            Completed
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-slate-600 dark:text-slate-400">
                            Medical Knowledge
                          </span>
                          <span className="font-medium text-emerald-600 dark:text-emerald-400 text-xs">
                            Completed
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Communication</span>
                          <span className="font-medium text-amber-600 dark:text-amber-400 text-xs">
                            In Progress
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Main Dashboard Preview - Fixed sizing and spacing */}
                <Card className="relative z-0 overflow-hidden border-0 bg-white/95 shadow-2xl backdrop-blur-sm dark:bg-slate-800/95">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-teal-500/5 to-emerald-500/5" />
                  <CardContent className="relative p-4 sm:p-6 lg:p-8">
                    <div className="mb-4 sm:mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600 to-teal-600">
                          <Image
                            src="/logo-medstint.svg"
                            alt="MedStint"
                            width={20}
                            height={20}
                            className="h-5 w-5 sm:h-6 sm:w-6"
                          />
                        </div>
                        <div>
                          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                            MedStint Dashboard
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                            Live System Preview
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-gradient-to-r from-emerald-100 to-cyan-100 text-emerald-800 dark:from-emerald-900 dark:to-cyan-900 dark:text-emerald-300 text-xs sm:text-sm">
                        <Zap className="mr-1 h-3 w-3" />
                        Active
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="rounded-lg bg-slate-50 p-3 sm:p-4 dark:bg-slate-700/50">
                        <div className="mb-1 sm:mb-2 flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                            Students
                          </span>
                          <Users className="h-3 w-3 sm:h-4 sm:w-4 text-cyan-600 dark:text-cyan-400" />
                        </div>
                        <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                          2,847
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">
                          +12% this month
                        </div>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3 sm:p-4 dark:bg-slate-700/50">
                        <div className="mb-1 sm:mb-2 flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                            Rotations
                          </span>
                          <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white">
                          156
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">
                          +8% this month
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 sm:mt-4">
                      <div className="mb-1 sm:mb-2 flex items-center justify-between text-xs sm:text-sm">
                        <span className="text-slate-600 dark:text-slate-400">
                          System Performance
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">98.5%</span>
                      </div>
                      <Progress value={98.5} className="h-1.5 sm:h-2" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
