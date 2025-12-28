"use client"

import { BadgeCheck, Goal, MousePointerClick, Newspaper, PictureInPicture, TabletSmartphone } from "lucide-react"
import { useId } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card"

interface FeatureProps {
    icon: React.ElementType
    title: string
    description: string
}

const featureList: FeatureProps[] = [
    {
        icon: TabletSmartphone,
        title: "Mobile Friendly",
        description: "Track clinical hours, rotations, and competency progress in real-time.",
    },
    {
        icon: BadgeCheck,
        title: "Social Proof",
        description: "Comprehensive evaluation tools for preceptors and clinical supervisors.",
    },
    {
        icon: Goal,
        title: "Targeted",
        description: "Secure authentication and role-based access for all users.",
    },
    {
        icon: PictureInPicture,
        title: "Perfect for SaaS",
        description: "Generate detailed reports and analytics for program management.",
    },
    {
        icon: MousePointerClick,
        title: "Easy to customize",
        description: "Seamless integration with existing healthcare education systems.",
    },
    {
        icon: Newspaper,
        title: "Perfect for Developers",
        description: "24/7 support and comprehensive onboarding for all users.",
    },
]

export const FeaturesSection = () => {
    const sectionId = useId()
    return (
        <section id={`features-${sectionId}`} className="container mx-auto px-4 py-24 sm:py-32">
            <h2 className="mb-2 text-center text-lg text-primary tracking-wider">Features</h2>
            <h2 className="mb-4 text-center font-bold text-3xl md:text-4xl">Everything You Need</h2>
            <h3 className="mx-auto mb-8 text-center text-muted-foreground text-xl md:w-1/2">
                Launch your SaaS faster with our carefully chosen tech stack and pre-built features. Focus
                on your unique value proposition, not boilerplate.
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featureList.map(({ icon: Icon, title, description }) => (
                    <div key={title}>
                        <Card className="h-full border-0 bg-background shadow-none">
                            <CardHeader className="flex items-center justify-center gap-4 pb-2 align-middle">
                                <div className="rounded-full bg-primary/20 p-2 ring-8 ring-primary/10">
                                    <Icon className="h-6 w-6 text-primary" />
                                </div>
                                <CardTitle>{title}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-center text-muted-foreground">{description}</CardContent>
                        </Card>
                    </div>
                ))}
            </div>
        </section>
    )
}