"use client"

import { SignOutButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { LogOut, Moon, Sun } from "lucide-react"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div
      className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-foreground selection:bg-teal-500/20"
      style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Elegant Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Standardized Gradient Background */}
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]" />

        {/* Animated Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/10 blur-[120px] animate-pulse-slow delay-1000" />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-50 px-4 sm:px-6 py-4 flex justify-between items-center glass-header mx-4 mt-4"
      >
        <div className="flex items-center gap-2.5">
          {/* Logo */}
          <motion.div
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-teal-600 dark:bg-teal-500 text-white shadow-md shadow-teal-500/20"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="font-bold text-sm">MS</span>
          </motion.div>
          <span
            className="text-lg tracking-tight text-slate-900 dark:text-white hidden sm:block"
            style={{ fontFamily: "'Playfair Display', ui-serif, Georgia, serif" }}
          >
            <span className="font-light">Med</span>
            <span className="font-bold text-teal-600 dark:text-teal-400">Stint</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          {mounted && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 shadow-sm hover:shadow-md backdrop-blur-md hover:bg-white/10 hover:scale-105 transition-all duration-200"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4 text-slate-600" />
              )}
            </motion.button>
          )}

          <SignOutButton>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white rounded-xl"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </SignOutButton>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 px-4 sm:px-6 pb-8">{children}</main>
    </div>
  )
}
