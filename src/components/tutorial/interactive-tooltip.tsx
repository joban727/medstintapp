"use client"

import { AnimatePresence, motion } from "framer-motion"
import { ChevronDown, ChevronUp, ExternalLink, HelpCircle, Play } from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"

export interface TooltipContent {
  title?: string
  description: string
  tips?: string[]
  videoUrl?: string
  externalLink?: {
    url: string
    text: string
  }
  examples?: string[]
  validation?: {
    rules: string[]
    errorMessages: string[]
  }
}

export interface InteractiveTooltipProps {
  content: TooltipContent
  children: ReactNode
  trigger?: "hover" | "click" | "focus"
  position?: "top" | "bottom" | "left" | "right" | "auto"
  showIcon?: boolean
  iconPosition?: "left" | "right"
  className?: string
  disabled?: boolean
  persistent?: boolean
  maxWidth?: number
}

export function InteractiveTooltip({
  content,
  children,
  trigger = "hover",
  position = "auto",
  showIcon = true,
  iconPosition = "right",
  className,
  disabled = false,
  persistent = false,
  maxWidth = 320,
}: InteractiveTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [calculatedPosition, setCalculatedPosition] = useState<"top" | "bottom" | "left" | "right">(
    "top"
  )
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate optimal position
  const calculatePosition = () => {
    if (!triggerRef.current || position !== "auto") {
      setCalculatedPosition(position as "top" | "bottom" | "left" | "right")
      return
    }

    const rect = triggerRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const tooltipHeight = 200 // Estimated height
    const tooltipWidth = maxWidth

    // Check available space in each direction
    const spaceTop = rect.top
    const spaceBottom = viewportHeight - rect.bottom
    const spaceLeft = rect.left
    const spaceRight = viewportWidth - rect.right

    // Determine best position based on available space
    if (spaceBottom >= tooltipHeight) {
      setCalculatedPosition("bottom")
    } else if (spaceTop >= tooltipHeight) {
      setCalculatedPosition("top")
    } else if (spaceRight >= tooltipWidth) {
      setCalculatedPosition("right")
    } else if (spaceLeft >= tooltipWidth) {
      setCalculatedPosition("left")
    } else {
      setCalculatedPosition("bottom") // Default fallback
    }
  }

  const showTooltip = () => {
    if (disabled) return
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    calculatePosition()
    setIsVisible(true)
  }

  const hideTooltip = () => {
    if (persistent && isVisible) return
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false)
      setIsExpanded(false)
    }, 150)
  }

  const handleMouseEnter = () => {
    if (trigger === "hover") showTooltip()
  }

  const handleMouseLeave = () => {
    if (trigger === "hover") hideTooltip()
  }

  const handleClick = () => {
    if (trigger === "click") {
      if (isVisible) {
        setIsVisible(false)
        setIsExpanded(false)
      } else {
        showTooltip()
      }
    }
  }

  const handleFocus = () => {
    if (trigger === "focus") showTooltip()
  }

  const handleBlur = () => {
    if (trigger === "focus") hideTooltip()
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Position styles based on calculated position
  const getTooltipStyles = () => {
    const baseStyles = {
      position: "absolute" as const,
      zIndex: 50,
      maxWidth: `${maxWidth}px`,
    }

    switch (calculatedPosition) {
      case "top":
        return {
          ...baseStyles,
          bottom: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginBottom: "8px",
        }
      case "bottom":
        return {
          ...baseStyles,
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          marginTop: "8px",
        }
      case "left":
        return {
          ...baseStyles,
          right: "100%",
          top: "50%",
          transform: "translateY(-50%)",
          marginRight: "8px",
        }
      case "right":
        return {
          ...baseStyles,
          left: "100%",
          top: "50%",
          transform: "translateY(-50%)",
          marginLeft: "8px",
        }
      default:
        return baseStyles
    }
  }

  const hasExpandableContent =
    content.tips || content.examples || content.validation || content.videoUrl

  return (
    <div
      ref={triggerRef}
      className={cn("relative inline-flex items-center gap-2", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {iconPosition === "left" && showIcon && (
        <HelpCircle className="h-4 w-4 cursor-help text-gray-400 transition-colors hover:text-blue-500" />
      )}

      {children}

      {iconPosition === "right" && showIcon && (
        <HelpCircle className="h-4 w-4 cursor-help text-gray-400 transition-colors hover:text-blue-500" />
      )}

      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            style={getTooltipStyles()}
            initial={{ opacity: 0, scale: 0.95, y: calculatedPosition === "top" ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: calculatedPosition === "top" ? 10 : -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onMouseEnter={() => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
              }
            }}
            onMouseLeave={hideTooltip}
          >
            <Card className="border border-gray-200 bg-white shadow-lg">
              <CardContent className="space-y-3 p-4">
                {content.title && (
                  <h4 className="font-semibold text-gray-900 text-sm">{content.title}</h4>
                )}

                <p className="text-gray-700 text-sm leading-relaxed">{content.description}</p>

                {content.externalLink && (
                  <a
                    href={content.externalLink.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 text-xs transition-colors hover:text-blue-800"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {content.externalLink.text}
                  </a>
                )}

                {hasExpandableContent && (
                  <div className="border-t pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleExpanded}
                      className="h-6 p-0 text-gray-600 text-xs hover:text-gray-800"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="mr-1 h-3 w-3" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="mr-1 h-3 w-3" />
                          Show More
                        </>
                      )}
                    </Button>
                  </div>
                )}

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="space-y-3 overflow-hidden"
                    >
                      {content.tips && content.tips.length > 0 && (
                        <div className="rounded-lg bg-blue-50 p-3">
                          <h5 className="mb-2 font-medium text-blue-900 text-xs">💡 Tips:</h5>
                          <ul className="space-y-1 text-blue-800 text-xs">
                            {content.tips.map((tip, index) => (
                              <li key={`tip-${index}-${tip.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`} className="flex items-start gap-1">
                                <span className="mt-0.5 text-blue-600">•</span>
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {content.examples && content.examples.length > 0 && (
                        <div className="rounded-lg bg-green-50 p-3">
                          <h5 className="mb-2 font-medium text-green-900 text-xs">✅ Examples:</h5>
                          <ul className="space-y-1 text-green-800 text-xs">
                            {content.examples.map((example, index) => (
                              <li key={`example-${index}-${example.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`} className="rounded bg-green-100 px-2 py-1 font-mono">
                                {example}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {content.validation && (
                        <div className="rounded-lg bg-amber-50 p-3">
                          <h5 className="mb-2 font-medium text-amber-900 text-xs">
                            ⚠️ Validation Rules:
                          </h5>
                          <ul className="space-y-1 text-amber-800 text-xs">
                            {content.validation.rules.map((rule, index) => (
                              <li key={`rule-${index}-${rule.slice(0, 20).replace(/\s+/g, '-').toLowerCase()}`} className="flex items-start gap-1">
                                <span className="mt-0.5 text-amber-600">•</span>
                                <span>{rule}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {content.videoUrl && (
                        <div className="rounded-lg bg-gray-50 p-3">
                          <div className="mb-2 flex items-center gap-2">
                            <Play className="h-3 w-3 text-gray-600" />
                            <span className="font-medium text-gray-900 text-xs">
                              Video Tutorial
                            </span>
                          </div>
                          <video
                            src={content.videoUrl}
                            controls
                            className="h-24 w-full rounded object-cover"
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Helper component for wrapping form fields with tooltips
export function TooltipWrapper({
  tooltip,
  children,
  ...props
}: {
  tooltip: TooltipContent
  children: ReactNode
} & Omit<InteractiveTooltipProps, "content" | "children">) {
  return (
    <InteractiveTooltip content={tooltip} {...props}>
      {children}
    </InteractiveTooltip>
  )
}
