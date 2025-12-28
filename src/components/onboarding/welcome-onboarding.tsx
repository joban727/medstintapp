"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "../ui/button"
import { motion } from "framer-motion"
import {
  ArrowRight,
  Check,
  Building2,
  GraduationCap,
  ClipboardCheck,
  Loader2,
  Sparkles,
} from "lucide-react"

interface WelcomeOnboardingProps {
  user: any
  clerkUser: any
}

export function WelcomeOnboarding({ user, clerkUser }: WelcomeOnboardingProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleGetStarted = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/onboarding/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStep: 1,
          completedSteps: [],
          formData: {},
          isCompleted: false,
        }),
      })

      if (!response.ok) throw new Error("Failed to initialize")
      router.push("/onboarding/school-profile")
    } catch (error) {
      toast.error("Something went wrong. Please try again.")
      setIsLoading(false)
    }
  }

  const steps = [
    { icon: Building2, label: "School Profile", description: "Add your institution details" },
    { icon: GraduationCap, label: "Programs", description: "Configure academic programs" },
    { icon: ClipboardCheck, label: "Clinical Sites", description: "Set up rotation locations" },
  ]

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-xl text-center"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-4 py-2 text-xs font-medium tracking-wider text-slate-600 dark:text-slate-300 mb-6 backdrop-blur-sm shadow-sm uppercase"
        >
          <Sparkles className="mr-2 h-3.5 w-3.5 text-teal-500" />
          School Administrator
        </motion.div>

        {/* Welcome Text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="text-base font-medium text-teal-600 dark:text-teal-400 mb-3"
        >
          Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </motion.p>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-3xl sm:text-4xl md:text-5xl font-light text-slate-900 dark:text-white mb-4 tracking-tight leading-tight"
          style={{ fontFamily: "'Playfair Display', ui-serif, Georgia, serif" }}
        >
          Set up your{" "}
          <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500 dark:from-teal-400 dark:to-emerald-400">
            workspace
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="text-slate-500 dark:text-slate-400 mb-10 max-w-md mx-auto font-light"
        >
          Configure your institution in a few simple steps. This will only take about 5 minutes.
        </motion.p>

        {/* Main Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/50 rounded-2xl p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 backdrop-blur-xl mb-8"
        >
          {/* Steps Preview */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1, duration: 0.4 }}
                className="flex flex-col items-center text-center group"
              >
                <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/30 transition-colors duration-300">
                  <step.icon className="h-5 w-5 text-slate-500 dark:text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors duration-300" />
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-0.5">
                  {step.label}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden sm:block">
                  {step.description}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-200 dark:bg-slate-700 mb-6" />

          {/* CTA Button */}
          <motion.div
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
          >
            <Button
              onClick={handleGetStarted}
              disabled={isLoading}
              size="lg"
              className="w-full h-12 text-base font-medium rounded-xl shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white group overflow-hidden relative"
            >
              {/* Shimmer effect */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Getting started...
                </>
              ) : (
                <>
                  <span className="relative">Get Started</span>
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </motion.div>

          {/* Skip Option */}
          <button
            onClick={async () => {
              setIsLoading(true)
              try {
                const { skipOnboarding } = await import("@/app/actions/onboarding")
                const result = await skipOnboarding()
                if (result?.success) {
                  router.push("/dashboard")
                }
              } catch (error) {
                toast.error("Failed to skip")
                setIsLoading(false)
              }
            }}
            className="mt-5 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors duration-200"
          >
            I'll do this later
          </button>
        </motion.div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider"
        >
          {["HIPAA Compliant", "Secure & Encrypted", "Free Forever"].map((item, index) => (
            <motion.div
              key={item}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 + index * 0.1, duration: 0.3 }}
              className="flex items-center gap-1.5"
            >
              <Check className="h-3.5 w-3.5 text-teal-500" />
              <span>{item}</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
