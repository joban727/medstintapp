"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, RotateCcw, SkipForward, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "../../lib/utils"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"

export interface TutorialStep {
  id: string
  title: string
  content: string
  target?: string // CSS selector for the element to highlight
  position?: "top" | "bottom" | "left" | "right" | "center"
  action?: "click" | "input" | "hover" | "none"
  validation?: () => boolean
  onComplete?: () => void
  videoUrl?: string
  tips?: string[]
}

export interface TutorialOverlayProps {
  steps: TutorialStep[]
  isActive: boolean
  onComplete: () => void
  onSkip: () => void
  onClose: () => void
  currentStepIndex?: number
  showProgress?: boolean
  allowSkip?: boolean
  allowReplay?: boolean
  className?: string
}

export function TutorialOverlay({
  steps,
  isActive,
  onComplete,
  onSkip,
  onClose,
  currentStepIndex = 0,
  showProgress = true,
  allowSkip = true,
  allowReplay = true,
  className,
}: TutorialOverlayProps) {
  const [currentStep, setCurrentStep] = useState(currentStepIndex)
  const [highlightedElement, setHighlightedElement] = useState<Element | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const overlayRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const currentStepData = steps[currentStep]
  const isLastStep = currentStep === steps.length - 1
  const progress = ((currentStep + 1) / steps.length) * 100

  // Calculate spotlight position and tooltip placement
  const updateHighlight = useCallback(() => {
    if (!currentStepData?.target) {
      setHighlightedElement(null)
      return
    }

    const element = document.querySelector(currentStepData.target)
    if (!element) {
      console.warn(`Tutorial target not found: ${currentStepData.target}`)
      return
    }

    setHighlightedElement(element)

    // Calculate tooltip position
    const rect = element.getBoundingClientRect()
    const tooltipRect = tooltipRef.current?.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let x = rect.left + rect.width / 2
    let y = rect.top

    // Adjust position based on preference and viewport constraints
    switch (currentStepData.position) {
      case "top":
        y = rect.top - (tooltipRect?.height || 200) - 20
        break
      case "bottom":
        y = rect.bottom + 20
        break
      case "left":
        x = rect.left - (tooltipRect?.width || 300) - 20
        y = rect.top + rect.height / 2
        break
      case "right":
        x = rect.right + 20
        y = rect.top + rect.height / 2
        break
      case "center":
        x = viewportWidth / 2
        y = viewportHeight / 2
        break
      default:
        // Auto-position based on available space
        if (rect.top > viewportHeight / 2) {
          y = rect.top - (tooltipRect?.height || 200) - 20
        } else {
          y = rect.bottom + 20
        }
    }

    // Ensure tooltip stays within viewport
    x = Math.max(20, Math.min(x, viewportWidth - (tooltipRect?.width || 300) - 20))
    y = Math.max(20, Math.min(y, viewportHeight - (tooltipRect?.height || 200) - 20))

    setTooltipPosition({ x, y })

    // Scroll element into view if needed
    element.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [currentStepData])

  // Update highlight when step changes
  useEffect(() => {
    if (isActive) {
      updateHighlight()
      // Re-calculate on window resize
      const handleResize = () => updateHighlight()
      window.addEventListener("resize", handleResize)
      return () => window.removeEventListener("resize", handleResize)
    }
  }, [isActive, updateHighlight])

  const handleNext = () => {
    if (currentStepData?.validation && !currentStepData.validation()) {
      return // Don't proceed if validation fails
    }

    currentStepData?.onComplete?.()

    if (isLastStep) {
      onComplete()
    } else {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  // Handle keyboard navigation
  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose()
          break
        case "ArrowRight":
        case "Enter":
          if (!isLastStep) {
            handleNext()
          } else {
            onComplete()
          }
          break
        case "ArrowLeft":
          if (currentStep > 0) {
            handlePrevious()
          }
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isActive, currentStep, isLastStep, onClose, onComplete, handleNext, handlePrevious])

  const handleSkip = () => {
    onSkip()
  }

  const handleReplay = () => {
    setCurrentStep(0)
  }

  if (!isActive || !currentStepData) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        className={cn("fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm", className)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Spotlight effect */}
        {highlightedElement && (
          <motion.div
            className="pointer-events-none absolute"
            style={{
              left: highlightedElement.getBoundingClientRect().left - 8,
              top: highlightedElement.getBoundingClientRect().top - 8,
              width: highlightedElement.getBoundingClientRect().width + 16,
              height: highlightedElement.getBoundingClientRect().height + 16,
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="h-full w-full rounded-lg border-2 border-blue-400 bg-white/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
            <motion.div
              className="-inset-2 absolute rounded-lg border border-blue-300"
              animate={{
                scale: [1, 1.05, 1],
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "easeInOut",
              }}
            />
          </motion.div>
        )}

        {/* Tutorial tooltip */}
        <motion.div
          ref={tooltipRef}
          className="absolute max-w-sm"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: currentStepData.position === "center" ? "translate(-50%, -50%)" : "none",
          }}
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <Card className="border-2 border-blue-200 bg-white shadow-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {currentStep + 1} of {steps.length}
                  </Badge>
                  <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-6 w-6 p-0 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {showProgress && <Progress value={progress} className="mt-2 h-2" />}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-700 text-sm leading-relaxed">{currentStepData.content}</p>

              {currentStepData.videoUrl && (
                <div className="overflow-hidden rounded-lg">
                  <video
                    src={currentStepData.videoUrl}
                    controls
                    className="h-32 w-full object-cover"
                  />
                </div>
              )}

              {currentStepData.tips && currentStepData.tips.length > 0 && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <h4 className="mb-2 font-medium text-blue-900 text-sm">💡 Tips:</h4>
                  <ul className="space-y-1 text-blue-800 text-xs">
                    {currentStepData.tips.map((tip, index) => (
                      <li key={`tip-${tip.slice(0, 20)}-${index}`} className="flex items-start gap-1">
                        <span className="mt-0.5 text-blue-600">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="flex gap-2">
                  {allowReplay && currentStep > 0 && (
                    <Button variant="outline" size="sm" onClick={handleReplay} className="text-xs">
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Replay
                    </Button>
                  )}
                  {allowSkip && (
                    <Button variant="outline" size="sm" onClick={handleSkip} className="text-xs">
                      <SkipForward className="mr-1 h-3 w-3" />
                      Skip Tutorial
                    </Button>
                  )}
                </div>

                <div className="flex gap-2">
                  {currentStep > 0 && (
                    <Button variant="outline" size="sm" onClick={handlePrevious}>
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      Previous
                    </Button>
                  )}
                  <Button size="sm" onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
                    {isLastStep ? "Complete" : "Next"}
                    {!isLastStep && <ChevronRight className="ml-1 h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
