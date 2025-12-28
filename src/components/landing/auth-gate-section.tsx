"use client"

import { motion } from "@/components/ui/motion"
import { GlassCard } from "@/components/ui/glass-card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Clock, ClipboardCheck, LayoutDashboard, ArrowRight } from "lucide-react"

const features = [
  {
    title: "Verified Time Tracking",
    description:
      "Geo-verified clock-in/out for students. Ensure accurate clinical hours with location-based validation.",
    icon: Clock,
    href: "/auth/sign-in?redirect=/dashboard/student/time-records",
  },
  {
    title: "Digital Evaluations",
    description:
      "Instant, paperless evaluations. Preceptors can complete assessments directly on their mobile devices.",
    icon: ClipboardCheck,
    href: "/auth/sign-in?redirect=/dashboard/preceptor/evaluations",
  },
  {
    title: "Centralized Oversight",
    description:
      "Real-time dashboards for School Admins. Monitor student progress and site compliance in one place.",
    icon: LayoutDashboard,
    href: "/auth/sign-in?redirect=/dashboard/school-admin",
  },
]

export const AuthGateSection = () => {
  return (
    <section className="py-24 relative z-10">
      <div className="container px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Link href={feature.href} className="block h-full group">
                <GlassCard className="h-full p-8 flex flex-col items-start space-y-4 hover:border-primary/30 transition-colors duration-300">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed flex-grow">
                    {feature.description}
                  </p>
                  <div className="flex items-center text-primary font-medium text-sm pt-2 group-hover:translate-x-1 transition-transform">
                    Access Feature <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </GlassCard>
              </Link>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 text-center"
        >
          <div className="inline-block p-[1px] rounded-full bg-gradient-to-r from-primary/50 to-accent/50">
            <Button
              asChild
              size="lg"
              className="rounded-full px-8 h-12 bg-background/80 backdrop-blur-md hover:bg-background/90 text-foreground border-0"
            >
              <Link href="/auth/sign-in">Sign In to Access Full Platform</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/auth/sign-in" className="text-primary hover:underline">
              Log in now
            </Link>
          </p>
        </motion.div>
      </div>
    </section>
  )
}
