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
        {/* Soft ambient gradients */}
        <div className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-teal-100/20 dark:bg-teal-900/10 rounded-full blur-[200px]" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[80%] h-[80%] bg-slate-200/25 dark:bg-slate-800/20 rounded-full blur-[200px]" />

        {/* Subtle scanning line */}
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent animate-xray-scan opacity-40" />

        {/* Fine grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-50 px-4 sm:px-6 py-4 flex justify-between items-center"
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
            <span className="font-light">Med</span><span className="font-bold text-teal-600 dark:text-teal-400">Stint</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          {mounted && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md backdrop-blur-sm hover:scale-105 transition-all duration-200"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
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
