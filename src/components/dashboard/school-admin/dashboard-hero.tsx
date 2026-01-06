"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Calendar, Clock, ShieldCheck, Activity } from "lucide-react"
import { DashboardCard } from "@/components/dashboard/shared/dashboard-card"

interface DashboardHeroProps {
  userName?: string
  schoolName?: string
}

export function DashboardHero({ userName, schoolName }: DashboardHeroProps) {
  const [mounted, setMounted] = useState(false)
  const [greeting, setGreeting] = useState("")
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  useEffect(() => {
    setMounted(true)
    setCurrentTime(new Date())

    const updateGreeting = () => {
      const hour = new Date().getHours()
      if (hour < 12) setGreeting("Good morning")
      else if (hour < 18) setGreeting("Good afternoon")
      else setGreeting("Good evening")
    }

    updateGreeting()
    const timer = setInterval(() => {
      setCurrentTime(new Date())
      updateGreeting()
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  if (!mounted) return null

  return (
    <div className="relative">
      <DashboardCard
        variant="premium"
        className="relative overflow-hidden border-white/10 p-8 text-white shadow-2xl"
      >
        {/* Decorative Background Elements */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 h-96 w-96 rounded-full bg-white/5 blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 rounded-full bg-white/5 blur-3xl animate-blob" />

        <div className="relative z-10 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex flex-wrap items-center gap-2 text-[var(--text-tertiary)]"
            >
              <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm backdrop-blur-md border border-white/10">
                <ShieldCheck className="h-4 w-4 text-white/70" />
                <span>Admin Access Verified</span>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm backdrop-blur-md border border-white/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/50 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white/70"></span>
                </span>
                <span>System Operational</span>
              </div>
              {schoolName && (
                <div className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm backdrop-blur-md border border-white/10">
                  <Activity className="h-4 w-4 text-white/70" />
                  <span>{schoolName}</span>
                </div>
              )}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl text-white"
            >
              {greeting}, <br />
              <span className="text-white">{userName || "Admin"}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-xl text-lg text-[var(--text-tertiary)]"
            >
              Here's what's happening at your school today. You have pending actions requiring your
              attention.
            </motion.p>
          </div>

          {/* Time Widget */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col items-end gap-2"
          >
            <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 backdrop-blur-md border border-white/10 hover:bg-white/10 transition-colors shadow-sm">
              <Clock className="h-8 w-8 text-white/70" />
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums tracking-tight text-white">
                  {currentTime?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="text-sm text-[var(--text-tertiary)] flex items-center gap-2 justify-end">
                  <Calendar className="h-3 w-3" />
                  {currentTime?.toLocaleDateString([], {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </DashboardCard>
    </div>
  )
}
