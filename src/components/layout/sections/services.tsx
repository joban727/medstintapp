"use client"

import type { JSX } from "react"
import { useId } from "react"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ServiceProps {
  title: string
  description: string
  icon: JSX.Element
}

const serviceList: ServiceProps[] = [
  {
    title: "Code Review",
    description:
      "Comprehensive clinical rotation management with real-time tracking and automated scheduling.",
    icon: <div className="h-6 w-6 rounded-full bg-primary" />,
  },
  {
    title: "Project Management",
    description:
      "Advanced competency assessment tools with detailed progress tracking and reporting.",
    icon: <div className="h-6 w-6 rounded-full bg-primary" />,
  },
  {
    title: "Quality Assurance",
    description:
      "Powerful analytics and reporting dashboard for program administrators and supervisors.",
    icon: <div className="h-6 w-6 rounded-full bg-primary" />,
  },
  {
    title: "Customer Support",
    description: "Seamless integration with existing healthcare education systems and workflows.",
    icon: <div className="h-6 w-6 rounded-full bg-primary" />,
  },
]

export const ServicesSection = () => {
  const sectionId = useId()
  return (
    <section id={`services-${sectionId}`} className="container mx-auto px-4 py-24 sm:py-32">
      <h2 className="mb-2 text-center text-lg text-primary tracking-wider">Core Features</h2>

      <h2 className="mb-4 text-center font-bold text-3xl md:text-4xl">Built-in Functionality</h2>
      <h3 className="mx-auto mb-8 text-center text-muted-foreground text-xl md:w-1/2">
        Start with a solid foundation. Our starter includes essential features that every modern
        SaaS needs, saving you weeks of development time.
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" />

      <div className="mx-auto grid w-full gap-4 sm:grid-cols-2 lg:w-[60%] lg:grid-cols-2">
        {serviceList.map(({ title, description }) => (
          <Card key={title} className="relative h-full bg-muted/60">
            <CardHeader>
              <CardTitle className="font-bold text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  )
}
