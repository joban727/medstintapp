"use client"

import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

interface PremiumLayoutProps {
    children: React.ReactNode
    className?: string
}

export function PremiumLayout({ children, className }: PremiumLayoutProps) {
    return (
        <div className="relative min-h-screen w-full overflow-hidden bg-[hsl(var(--deep-slate))] text-[hsl(var(--deep-slate-foreground))]">
            {/* Dynamic Aurora Background */}
            <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03]" />

                {/* Primary Blob - Indigo */}
                <div className="absolute top-[-10%] left-[-10%] h-[800px] w-[800px] rounded-full bg-[hsl(var(--premium-indigo)/0.15)] blur-[120px] animate-blob mix-blend-screen" />

                {/* Secondary Blob - Violet */}
                <div className="absolute top-[20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-[hsl(var(--premium-violet)/0.15)] blur-[100px] animate-blob animation-delay-2000 mix-blend-screen" />

                {/* Accent Blob - Emerald */}
                <div className="absolute bottom-[-20%] left-[20%] h-[600px] w-[600px] rounded-full bg-[hsl(var(--premium-emerald)/0.1)] blur-[120px] animate-blob animation-delay-4000 mix-blend-screen" />
            </div>

            <div className={cn("relative z-10 p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto", className)}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-8"
                >
                    {children}
                </motion.div>
            </div>
        </div>
    )
}
