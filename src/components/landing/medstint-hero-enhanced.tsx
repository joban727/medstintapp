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
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
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
  { icon: Shield, title: "Secure & Compliant", description: "HIPAA-compliant platform ensuring data security" },
  { icon: Heart, title: "Student-Centered", description: "Designed with student success as the top priority" },
  { icon: TrendingUp, title: "Performance Driven", description: "Data-driven insights for better outcomes" },
]

export const MedStintHeroEnhanced = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    setIsVisible(true)

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [])

  return (
    <section className="relative min-h-[90vh] overflow-hidden bg-gradient-to-br from-cyan-50 via-teal-50 to-emerald-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="-top-40 -right-40 absolute h-80 w-80 animate-pulse rounded-full bg-gradient-to-br from-cyan-400/30 to-teal-400/30 blur-3xl" />
        <div className="-bottom-40 -left-40 absolute h-80 w-80 animate-pulse rounded-full bg-gradient-to-br from-emerald-400/30 to-cyan-400/30 blur-3xl delay-1000" />
        <div
          className="absolute h-32 w-32 rounded-full bg-gradient-to-br from-white/20 to-transparent blur-2xl transition-transform duration-300"
          style={{
            left: mousePosition.x - 64,
            top: mousePosition.y - 64,
          }}
        />
      </div>

      <div className="container relative mx-auto px-4 pt-20 pb-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left Column - Content */}
            <div
              className={`space-y-8 transition-all duration-1000 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
            >
              {/* Enhanced Logo Section */}
              <div className="flex items-center gap-4">
                <Image 
                  src="/logo-medstint.svg"
                  alt="MedStint Logo" 
                  width={80} 
                  height={80} 
                  className="h-20 w-20"
                />
                <div>
                  <h2 className="font-bold text-4xl bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">
                    MedStint
                  </h2>
                  <p className="text-slate-600 dark:text-slate-400 text-lg font-medium">Medical Education Management</p>
                  <p className="text-cyan-600 dark:text-cyan-400 text-sm font-semibold">Empowering Healthcare Education Excellence</p>
                </div>
              </div>

              {/* Brand Tagline */}
              <div className="bg-gradient-to-r from-cyan-100/50 to-teal-100/50 dark:from-cyan-900/30 dark:to-teal-900/30 rounded-xl p-6 border border-cyan-200/50 dark:border-cyan-800/50">
                <h3 className="font-bold text-xl text-cyan-800 dark:text-cyan-200 mb-2">
                  "Transforming Medical Education Through Innovation & Excellence"
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Leading the future of healthcare education with cutting-edge technology and student-centered solutions.
                </p>
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

              {/* Headline */}
              <div className="space-y-4">
                <h1 className="mb-6 font-bold text-4xl text-slate-900 tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl dark:text-white">
                Transform Medical Education with{" "}
                <span className="bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">
                  Education Management
                </span>
              </h1>
                <p className="text-slate-600 text-xl lg:text-2xl dark:text-slate-300">
                  Streamline clinical rotations, track student progress, and ensure competency
                  compliance with our comprehensive platform designed for modern medical education.
                </p>
              </div>

              {/* Brand Values */}
              <div className="grid gap-4 sm:grid-cols-1">
                {brandValues.map((value, index) => {
                  const Icon = value.icon
                  return (
                    <div key={index} className="flex items-center gap-4 p-4 rounded-lg bg-white/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-cyan-100 to-teal-100 dark:from-cyan-900 dark:to-teal-900">
                        <Icon className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-800 dark:text-slate-200">{value.title}</h4>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{value.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Key Benefits */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-cyan-100 to-teal-100 dark:from-cyan-900 dark:to-teal-900">
                    <CheckCircle className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">
                    Real-time Progress Tracking
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-emerald-100 to-cyan-100 dark:from-emerald-900 dark:to-cyan-900">
                    <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">Secure Data Management</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-teal-100 to-emerald-100 dark:from-teal-900 dark:to-emerald-900">
                    <CheckCircle className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">Automated Workflows</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-cyan-100 to-emerald-100 dark:from-cyan-900 dark:to-emerald-900">
                    <CheckCircle className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <span className="text-slate-700 dark:text-slate-300">
                    Comprehensive Reporting
                  </span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4">
                <Button
                asChild
                size="lg"
                className="bg-gradient-to-r from-cyan-600 to-teal-600 px-8 py-6 font-semibold text-lg text-white shadow-lg transition-all duration-200 hover:from-cyan-700 hover:to-teal-700 hover:shadow-xl"
              >
                <Link href="/auth/register">
                  <div className="flex items-center">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </div>
                </Link>
              </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-2 border-cyan-200 px-8 py-6 font-semibold text-lg text-cyan-700 hover:bg-cyan-50 hover:border-cyan-300 dark:border-cyan-800 dark:text-cyan-300 dark:hover:bg-cyan-900/50"
                >
                  <Link href="/demo">
                    <div className="flex items-center gap-2">
                      <Play className="h-5 w-5" />
                      Watch Demo
                    </div>
                  </Link>
                </Button>
              </div>

              {/* Stats */}
              <div className="grid gap-4 border-slate-200 border-t pt-8 sm:grid-cols-3 dark:border-slate-700">
                {heroStats.map((stat, index) => {
                  const Icon = stat.icon
                  return (
                    <div key={`hero-stat-${stat.label.replace(/\s+/g, '-').toLowerCase()}-${index}`} className="text-center">
                      <div className="mb-2 flex items-center justify-center gap-2">
                        <Icon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        <span className="font-bold text-2xl text-slate-900 dark:text-white">
                          {stat.value}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm dark:text-slate-400">{stat.label}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Right Column - Visual */}
            <div
              className={`relative transition-all delay-300 duration-1000 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}
            >
              <div className="relative mx-auto max-w-2xl">
                {/* Floating Cards */}
                <div className="group -top-4 -left-4 absolute w-72 rotate-[-8deg] transform transition-transform hover:rotate-[-4deg] hover:scale-105">
                  <Card className="relative border-slate-200 bg-white/60 shadow-2xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/90 border border-slate-200/50">
                    <CardContent className="p-6">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-teal-500">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">Student Dashboard</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Live Preview</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                            <div className="h-2 w-3/4 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500" />
                          </div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">85%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700">
                            <div className="h-2 w-1/2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" />
                          </div>
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">50%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="group -bottom-4 -right-4 absolute w-72 rotate-[8deg] transform transition-transform hover:rotate-[4deg] hover:scale-105">
                  <Card className="relative border-slate-200 bg-white/60 shadow-2xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/90 border border-slate-200/50">
                    <CardContent className="p-6">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500">
                          <Award className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">Competency Tracker</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Real-time Updates</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">Patient Care - Excellent</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">Communication - Proficient</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <span className="text-sm text-slate-600 dark:text-slate-300">Procedures - Competent</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Main Dashboard Preview */}
                <Card className="relative overflow-hidden border-slate-200 bg-white/70 shadow-2xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/90 border border-slate-200/50">
                  <CardContent className="p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500">
                          <Image 
                            src="/logo-medstint.svg"
                            alt="MedStint" 
                            width={24} 
                            height={24} 
                            className="h-6 w-6"
                          />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white">MedStint Dashboard</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Comprehensive Overview</p>
                        </div>
                      </div>
                      <Badge className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white">
                        Live
                      </Badge>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/50">
                        <div className="mb-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-600">
                          <div className="h-2 w-4/5 rounded-full bg-gradient-to-r from-cyan-500 to-teal-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Rotations</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/50">
                        <div className="mb-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-600">
                          <div className="h-2 w-3/5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Competency</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/50">
                        <div className="mb-2 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-600">
                          <div className="h-2 w-9/10 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500" />
                        </div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Progress</p>
                      </div>
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
