"use client"

import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

interface Action {
  icon: React.ElementType
  label: string
  onClick: () => void
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | string
  disabled?: boolean
}

interface FloatingActionButtonProps {
  actions?: Action[]
  onClick?: () => void
  className?: string
}

export function FloatingActionButton({ actions, onClick, className }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  if (!actions || actions.length === 0) {
    return (
      <Button
        className={cn(
          "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          className
        )}
        onClick={onClick}
      >
        <Plus className="h-6 w-6" />
      </Button>
    )
  }

  return (
    <div className={cn("fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2", className)}>
      <AnimatePresence>
        {isOpen && (
          <div className="flex flex-col items-end gap-2 mb-2">
            {actions.map((action, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center gap-2"
              >
                <span className="bg-white/5 backdrop-blur-md border border-white/10 px-2 py-1 rounded-md text-sm font-medium shadow-sm text-white">
                  {action.label}
                </span>
                <Button
                  size="icon"
                  variant={(action.variant as any) || "secondary"}
                  className="h-10 w-10 rounded-full shadow-md"
                  disabled={action.disabled}
                  onClick={() => {
                    if (action.disabled) return
                    action.onClick()
                    setIsOpen(false)
                  }}
                >
                  <action.icon className="h-5 w-5" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
      <Button
        className={cn(
          "h-14 w-14 rounded-full shadow-lg transition-transform duration-200",
          isOpen ? "rotate-45" : "rotate-0"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  )
}
