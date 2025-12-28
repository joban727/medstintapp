"use client"
import { motion } from "@/components/ui/motion"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const HeroMinimal = () => {
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  return (
    <header className="container mx-auto max-w-xl md:max-w-2xl lg:max-w-3xl 2xl:max-w-4xl 3xl:max-w-5xl px-4 pt-12 pb-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: "easeOut" }}
      >
        <h1 className="text-4xl md:text-5xl lg:text-6xl 3xl:text-6xl font-bold tracking-tight text-foreground">
          <span className="text-primary">MedStint</span> Streamline Medical Education with Confidence
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          MedStint streamlines clinical education management for medical schools, hospitals, and
          students. Track rotations, monitor competencies, and ensure compliance.
        </p>
      </motion.div>
      <motion.div
        className="mt-6 flex flex-wrap items-center gap-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: prefersReducedMotion ? 0 : 0.1,
          duration: prefersReducedMotion ? 0 : 0.35,
        }}
      >
        <Button
          asChild
          className="rounded-xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Link href="/auth/sign-in">Sign In</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="rounded-xl transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <Link href="/auth/sign-up">Create Account</Link>
        </Button>
      </motion.div>
      <motion.figure
        className="mt-8 h-2 w-24 rounded-full bg-primary/10"
        initial={{ opacity: 0, scaleX: 0.7 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
      />
    </header>
  )
}
