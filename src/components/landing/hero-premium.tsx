"use client"

import { motion } from "@/components/ui/motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Lock, Sparkles } from "lucide-react"

export const HeroPremium = () => {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-20 pb-20">
      {/* Aurora Background */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[100px] animate-blob mix-blend-multiply filter" />
        <div className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full bg-accent/20 blur-[100px] animate-blob animation-delay-2000 mix-blend-multiply filter" />
        <div className="absolute -bottom-32 left-1/3 h-[500px] w-[500px] rounded-full bg-purple-500/20 blur-[100px] animate-blob animation-delay-4000 mix-blend-multiply filter" />
      </div>

      <div className="container px-4 md:px-6 relative z-10">
        <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-primary backdrop-blur-md shadow-sm"
          >
            <Sparkles className="mr-2 h-3.5 w-3.5 text-primary" />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Streamlined Clinical Management
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground"
          >
            Clinical Education, <br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              MedStint
            </span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed"
          >
            <p className="mt-6 text-lg text-slate-600 dark:text-slate-300">
              MedStint is the complete solution for managing clinical rotations, tracking student
              competencies, and ensuring institutional compliance. Built
              for efficiency, designed for you.
            </p>
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto pt-4"
          >
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto h-12 px-8 rounded-full text-lg shadow-[0_0_30px_-5px_rgba(37,99,235,0.4)] hover:shadow-[0_0_40px_-5px_rgba(37,99,235,0.6)] transition-all duration-300"
            >
              <Link href="/auth/sign-in">
                <Lock className="mr-2 h-4 w-4" />
                Sign In to Dashboard
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="w-full sm:w-auto h-12 px-8 rounded-full text-lg border-white/10 bg-white/5 hover:bg-white/10 backdrop-blur-md transition-all"
            >
              <Link href="/auth/sign-up">
                Create Account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
