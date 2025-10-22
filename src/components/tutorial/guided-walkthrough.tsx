"use client"

import { AnimatePresence, motion } from "framer-motion"
import { BookOpen, Pause, Play, RotateCcw, SkipForward, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import Shepherd from "shepherd.js"
import { cn } from "../../lib/utils"
import type { UserRole } from "../../types"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"

// Import Shepherd CSS
import "shepherd.js/dist/css/shepherd.css"

export interface WalkthroughStep {
  id: string
  title: string
  text: string
  attachTo?: {
    element: string
    on:
      | "top"
      | "bottom"
      | "left"
      | "right"
      | "top-start"
      | "top-end"
      | "bottom-start"
      | "bottom-end"
      | "left-start"
      | "left-end"
      | "right-start"
      | "right-end"
  }
  buttons?: Array<{
    text: string
    action: "next" | "back" | "complete" | "skip" | (() => void)
    classes?: string
  }>
  beforeShowPromise?: () => Promise<void>
  when?: {
    show?: () => void
    hide?: () => void
    complete?: () => void
    cancel?: () => void
  }
  modalOverlayOpeningPadding?: number
  modalOverlayOpeningRadius?: number
  scrollTo?: boolean
  canClickTarget?: boolean
  advanceOn?: {
    selector: string
    event: string
  }
}

export interface WalkthroughConfig {
  id: string
  title: string
  description: string
  steps: WalkthroughStep[]
  userRole?: UserRole
  category?: "onboarding" | "feature" | "advanced"
  estimatedDuration?: number // in minutes
  prerequisites?: string[]
  completionBadge?: {
    name: string
    icon: string
    color: string
  }
}

export interface GuidedWalkthroughProps {
  config: WalkthroughConfig
  isActive: boolean
  onComplete: (walkthroughId: string) => void
  onSkip: (walkthroughId: string) => void
  onCancel: (walkthroughId: string) => void
  onStepChange?: (stepIndex: number, stepId: string) => void
  autoStart?: boolean
  showProgress?: boolean
  allowSkip?: boolean
  className?: string
}

export function GuidedWalkthrough({
  config,
  isActive,
  onComplete,
  onSkip,
  onCancel,
  onStepChange,
  autoStart = true,
  showProgress = true,
  allowSkip = true,
  className,
}: GuidedWalkthroughProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [showPreview, setShowPreview] = useState(!autoStart)
  const tourRef = useRef<Shepherd.Tour | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  const progress = ((currentStepIndex + 1) / config.steps.length) * 100

  // Initialize Shepherd tour
  const initializeTour = useCallback(() => {
    if (tourRef.current) {
      tourRef.current.complete()
    }

    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        classes: "shepherd-theme-custom",
        scrollTo: true,
        modalOverlayOpeningPadding: 8,
        modalOverlayOpeningRadius: 8,
        canClickTarget: false,
        when: {
          show: function () {
            const stepIndex = tour.steps.findIndex((step) => step === this)
            setCurrentStepIndex(stepIndex)
            onStepChange?.(stepIndex, config.steps[stepIndex]?.id || "")
          },
          complete: function () {
            const stepIndex = tour.steps.findIndex((step) => step === this)
            const stepId = config.steps[stepIndex]?.id
            if (stepId) {
              setCompletedSteps((prev) => new Set([...prev, stepId]))
            }
          },
        },
      },
    })

    // Add steps to tour
    config.steps.forEach((step, index) => {
      const isLastStep = index === config.steps.length - 1

      const buttons = step.buttons || [
        {
          text: "Back",
          action: "back",
          classes: "shepherd-button-secondary",
        },
        {
          text: isLastStep ? "Complete" : "Next",
          action: isLastStep ? "complete" : "next",
          classes: "shepherd-button-primary",
        },
      ]

      // Add skip button if allowed
      if (allowSkip && !isLastStep) {
        buttons.splice(-1, 0, {
          text: "Skip Tour",
          action: "skip",
          classes: "shepherd-button-secondary",
        })
      }

      tour.addStep({
        id: step.id,
        title: step.title,
        text: step.text,
        attachTo: step.attachTo,
        buttons: buttons.map((button) => ({
          text: button.text,
          classes: button.classes || "shepherd-button-primary",
          action: () => {
            switch (button.action) {
              case "next":
                tour.next()
                break
              case "back":
                tour.back()
                break
              case "complete":
                tour.complete()
                onComplete(config.id)
                break
              case "skip":
                tour.cancel()
                onSkip(config.id)
                break
              default:
                if (typeof button.action === "function") {
                  button.action()
                }
            }
          },
        })),
        beforeShowPromise: step.beforeShowPromise,
        when: {
          show: function () {
            const stepIndex = tour.steps.findIndex((s) => s === this)
            setCurrentStepIndex(stepIndex)
            onStepChange?.(stepIndex, step.id)
            step.when?.show?.()
          },
          ...(step.when?.hide && {
            hide: () => {
              step.when?.hide?.()
            },
          }),
          complete: () => {
            setCompletedSteps((prev) => new Set([...prev, step.id]))
            step.when?.complete?.()
          },
          ...(step.when?.cancel && {
            cancel: () => {
              step.when?.cancel?.()
            },
          }),
        },
        modalOverlayOpeningPadding: step.modalOverlayOpeningPadding,
        modalOverlayOpeningRadius: step.modalOverlayOpeningRadius,
        scrollTo: step.scrollTo,
        canClickTarget: step.canClickTarget,
        advanceOn: step.advanceOn,
      })
    })

    // Handle tour completion and cancellation
    tour.on("complete", () => {
      setIsPlaying(false)
      onComplete(config.id)
    })

    tour.on("cancel", () => {
      setIsPlaying(false)
      onCancel(config.id)
    })

    tourRef.current = tour
    return tour
  }, [config, onComplete, onSkip, onCancel, onStepChange, allowSkip])

  // Start tour
  const startTour = () => {
    const tour = initializeTour()
    tour.start()
    setIsPlaying(true)
    setIsPaused(false)
    setShowPreview(false)
  }

  // Pause/Resume tour
  const togglePause = () => {
    if (!tourRef.current) return

    if (isPaused) {
      // Resume - show current step
      tourRef.current.show(currentStepIndex)
      setIsPaused(false)
    } else {
      // Pause - hide current step
      tourRef.current.hide()
      setIsPaused(true)
    }
  }

  // Restart tour
  const restartTour = () => {
    if (tourRef.current) {
      tourRef.current.complete()
    }
    setCurrentStepIndex(0)
    setCompletedSteps(new Set())
    startTour()
  }

  // Skip tour
  const skipTour = () => {
    if (tourRef.current) {
      tourRef.current.cancel()
    }
    onSkip(config.id)
  }

  // Auto-start tour when active
  useEffect(() => {
    if (isActive && autoStart) {
      startTour()
    }

    return () => {
      if (tourRef.current) {
        tourRef.current.complete()
      }
    }
  }, [isActive, autoStart, startTour])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tourRef.current) {
        tourRef.current.complete()
      }
    }
  }, [])

  if (!isActive) {
    return null
  }

  return (
    <>
      {/* Custom Shepherd CSS */}
      <style jsx global>{`
        .shepherd-theme-custom {
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        }
        
        .shepherd-theme-custom .shepherd-header {
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
          padding: 16px;
        }
        
        .shepherd-theme-custom .shepherd-text {
          padding: 16px;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .shepherd-theme-custom .shepherd-footer {
          padding: 12px 16px;
          background: #f8fafc;
          border-top: 1px solid #e2e8f0;
        }
        
        .shepherd-button-primary {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .shepherd-button-primary:hover {
          background: #2563eb;
        }
        
        .shepherd-button-secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          margin-right: 8px;
        }
        
        .shepherd-button-secondary:hover {
          background: #e2e8f0;
        }
      `}</style>

      {/* Tour Preview/Control Panel */}
      <AnimatePresence>
        {(showPreview || isPaused) && (
          <motion.div
            className={cn("fixed top-4 right-4 z-[9998] max-w-sm", className)}
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-2 border-blue-200 bg-white shadow-xl">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">{config.title}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancel(config.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {config.category && (
                  <Badge variant="secondary" className="w-fit">
                    {config.category}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-gray-700 text-sm">{config.description}</p>

                <div className="flex items-center gap-4 text-gray-600 text-xs">
                  <span>{config.steps.length} steps</span>
                  {config.estimatedDuration && <span>~{config.estimatedDuration} min</span>}
                </div>

                {config.prerequisites && config.prerequisites.length > 0 && (
                  <div className="rounded-lg bg-amber-50 p-3">
                    <h4 className="mb-1 font-medium text-amber-900 text-xs">Prerequisites:</h4>
                    <ul className="space-y-1 text-amber-800 text-xs">
                      {config.prerequisites.map((prereq, index) => (
                        <li key={`prereq-${prereq.replace(/\s+/g, '-').toLowerCase()}-${prereq.length}`} className="flex items-start gap-1">
                          <span className="mt-0.5 text-amber-600">•</span>
                          <span>{prereq}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {showProgress && isPlaying && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-gray-600 text-xs">
                      <span>Progress</span>
                      <span>
                        {currentStepIndex + 1} of {config.steps.length}
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  {!isPlaying ? (
                    <Button onClick={startTour} className="flex-1">
                      <Play className="mr-2 h-4 w-4" />
                      Start Tour
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" onClick={togglePause} className="flex-1">
                        {isPaused ? (
                          <>
                            <Play className="mr-2 h-4 w-4" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={restartTour} size="sm">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {allowSkip && (
                    <Button variant="outline" onClick={skipTour} size="sm">
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {config.completionBadge && completedSteps.size === config.steps.length && (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="rounded-lg bg-green-50 p-3 text-center"
                  >
                    <div className="mb-1 text-2xl">{config.completionBadge.icon}</div>
                    <div className="font-medium text-green-900 text-sm">
                      {config.completionBadge.name}
                    </div>
                    <div className="text-green-700 text-xs">Earned!</div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
