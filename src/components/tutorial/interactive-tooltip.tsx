"use client"

import type { ReactNode } from "react"
import { cn } from "../../lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"

export interface TooltipContent {
  title?: string
  description: string
  tips?: string[]
  videoUrl?: string
  externalLink?: { url: string; text: string }
  examples?: string[]
  validation?: { rules: string[]; errorMessages: string[] }
}

export interface InteractiveTooltipProps {
  content: TooltipContent
  children: ReactNode
  trigger?: "hover" | "click" | "focus"
  position?: "top" | "bottom" | "left" | "right"
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
  position = "top",
  className,
  disabled = false,
  maxWidth = 320,
}: InteractiveTooltipProps) {
  if (disabled) {
    return <div className={className}>{children}</div>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("inline-flex", className)}>{children}</div>
        </TooltipTrigger>
        <TooltipContent side={position}>
          <div style={{ maxWidth }} className="space-y-2">
            {content.title && <div className="font-medium text-sm">{content.title}</div>}
            <p className="text-sm text-gray-700">{content.description}</p>
            {content.tips && content.tips.length > 0 && (
              <ul className="list-disc pl-4 text-xs text-gray-600">
                {content.tips.map((tip, i) => (
                  <li key={`tip-${i}`}>{tip}</li>
                ))}
              </ul>
            )}
            {content.examples && content.examples.length > 0 && (
              <div className="text-xs text-gray-600">
                <div className="font-medium">Examples</div>
                <ul className="list-disc pl-4">
                  {content.examples.map((ex, i) => (
                    <li key={`ex-${i}`}>{ex}</li>
                  ))}
                </ul>
              </div>
            )}
            {content.externalLink && (
              <a
                href={content.externalLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline text-xs"
              >
                {content.externalLink.text}
              </a>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Helper wrapper that forwards props
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
