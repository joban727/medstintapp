"use client"

import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/glass-card"
import { motion } from "@/components/ui/motion"
import { ArrowRight, Info, X } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

export function DemoBanner() {
    const [isVisible, setIsVisible] = useState(true)

    if (!isVisible) return null

    return (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform px-4 w-full max-w-3xl">
            <GlassCard className="flex items-center justify-between gap-4 py-4 px-6 shadow-2xl border-primary/20 bg-background/60 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <Button asChild size="sm" className="hidden sm:inline-flex shadow-lg shadow-primary/20">
                            <Link href="/auth/sign-up">
                                Start Free Trial
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full hover:bg-muted/50"
                            onClick={() => setIsVisible(false)}
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Dismiss</span>
                        </Button>
                    </div>
                </div>
            </GlassCard>
        </div>
    )
}
