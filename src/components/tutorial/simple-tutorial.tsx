"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronRight, ChevronLeft, HelpCircle, Sparkles } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"
import { cn } from "../../lib/utils"

interface TutorialStep {
    id: string
    title: string
    description: string
    icon?: React.ReactNode
}

interface SimpleTutorialProps {
    steps: TutorialStep[]
    isOpen: boolean
    onClose: () => void
    onComplete: () => void
    storageKey?: string
}

const defaultSteps: TutorialStep[] = [
    {
        id: "welcome",
        title: "Welcome to MedStintClerk!",
        description: "Let's get you started with setting up your school dashboard. This quick guide will show you the key areas to explore.",
        icon: <Sparkles className="h-6 w-6 text-indigo-400" />,
    },
    {
        id: "students",
        title: "Step 1: Add Your Students",
        description: "Click 'Students' in the sidebar to add and manage enrolled students. You can add them individually or import from a CSV file.",
    },
    {
        id: "programs",
        title: "Step 2: Set Up Programs",
        description: "Click 'Programs' to create your medical education programs. Define requirements, rotations, and competencies for each program.",
    },
    {
        id: "sites",
        title: "Step 3: Add Clinical Sites",
        description: "Click 'Clinical Sites' to add hospitals, clinics, and facilities where students will complete their rotations.",
    },
    {
        id: "rotations",
        title: "Step 4: Schedule Rotations",
        description: "Click 'Rotations' to assign students to clinical sites and manage their rotation schedules. You're all set!",
    },
]

export function SimpleTutorial({
    steps = defaultSteps,
    isOpen,
    onClose,
    onComplete,
    storageKey = "tutorial-completed",
}: SimpleTutorialProps) {
    const [currentStep, setCurrentStep] = useState(0)

    const handleNext = useCallback(() => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1)
        } else {
            // Complete tutorial
            if (storageKey) {
                localStorage.setItem(storageKey, "true")
            }
            onComplete()
            onClose()
        }
    }, [currentStep, steps.length, storageKey, onComplete, onClose])

    const handlePrev = useCallback(() => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1)
        }
    }, [currentStep])

    const handleSkip = useCallback(() => {
        if (storageKey) {
            localStorage.setItem(storageKey, "true")
        }
        onClose()
    }, [storageKey, onClose])

    // Reset to first step when opened
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(0)
        }
    }, [isOpen])

    const progress = ((currentStep + 1) / steps.length) * 100
    const step = steps[currentStep]
    const isLastStep = currentStep === steps.length - 1

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                        onClick={handleSkip}
                    />

                    {/* Tutorial Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md"
                    >
                        <Card className="border-2 border-indigo-500/30 bg-gradient-to-br from-slate-900 via-indigo-950/90 to-slate-900 text-white shadow-2xl shadow-indigo-500/20">
                            <CardHeader className="relative pb-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleSkip}
                                    className="absolute right-4 top-4 h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10"
                                >
                                    <X className="h-4 w-4" />
                                </Button>

                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30">
                                        {step.icon || <HelpCircle className="h-6 w-6 text-indigo-400" />}
                                    </div>
                                    <div>
                                        <p className="text-xs text-indigo-300 font-medium">
                                            Step {currentStep + 1} of {steps.length}
                                        </p>
                                        <CardTitle className="text-xl text-white">{step.title}</CardTitle>
                                    </div>
                                </div>

                                <Progress value={progress} className="h-1.5 bg-white/10" />
                            </CardHeader>

                            <CardContent className="pt-4 pb-6">
                                <p className="text-indigo-100/80 leading-relaxed mb-6">
                                    {step.description}
                                </p>

                                <div className="flex items-center justify-between gap-3">
                                    <Button
                                        variant="ghost"
                                        onClick={handleSkip}
                                        className="text-indigo-300 hover:text-white hover:bg-white/10"
                                    >
                                        Skip Tour
                                    </Button>

                                    <div className="flex gap-2">
                                        {currentStep > 0 && (
                                            <Button
                                                variant="outline"
                                                onClick={handlePrev}
                                                className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                                            >
                                                <ChevronLeft className="h-4 w-4 mr-1" />
                                                Back
                                            </Button>
                                        )}
                                        <Button
                                            onClick={handleNext}
                                            className="bg-indigo-500 hover:bg-indigo-600 text-white"
                                        >
                                            {isLastStep ? "Get Started" : "Next"}
                                            {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}

// Standalone hook and component for easy integration
export function useTutorial(storageKey = "school-admin-tutorial-completed") {
    const [isOpen, setIsOpen] = useState(false)
    const [hasCompleted, setHasCompleted] = useState(true) // Default to true to prevent flash

    useEffect(() => {
        // Check localStorage on mount
        const completed = localStorage.getItem(storageKey)
        setHasCompleted(completed === "true")
    }, [storageKey])

    const open = useCallback(() => setIsOpen(true), [])
    const close = useCallback(() => setIsOpen(false), [])
    const complete = useCallback(() => {
        setHasCompleted(true)
        localStorage.setItem(storageKey, "true")
    }, [storageKey])
    const reset = useCallback(() => {
        setHasCompleted(false)
        localStorage.removeItem(storageKey)
    }, [storageKey])

    return { isOpen, hasCompleted, open, close, complete, reset }
}
