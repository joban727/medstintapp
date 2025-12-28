"use client"
import { motion } from "@/components/ui/motion"
import { CheckCircle } from "lucide-react"

const items = [
  "Advanced scheduling and rotation management",
  "Real-time competency tracking and assessment",
  "Comprehensive reporting and analytics",
]

export const ValueProps = () => {
  const prefersReducedMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  return (
    <section className="container mx-auto max-w-xl md:max-w-2xl lg:max-w-3xl 2xl:max-w-4xl 3xl:max-w-5xl px-4 py-8">
      <motion.ul
        className="space-y-3"
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: {
            transition: { staggerChildren: prefersReducedMotion ? 0 : 0.08 },
          },
        }}
      >
        {items.map((text, idx) => (
          <motion.li
            key={idx}
            className="flex items-start gap-2"
            variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
          >
            <CheckCircle className="h-5 w-5 md:h-6 md:w-6 text-primary mt-0.5" />
            <span className="text-foreground/90 text-base md:text-lg">{text}</span>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  )
}
