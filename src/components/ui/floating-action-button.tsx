"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Clock, FileText, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

interface ActionItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  onClick: () => void
}

interface FloatingActionButtonProps {
  actions: ActionItem[]
  className?: string
}

export function FloatingActionButton({ actions, className }: FloatingActionButtonProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className={cn("fixed bottom-6 right-6 z-50 md:hidden", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="mb-3 flex flex-col items-end space-y-3"
          >
            {actions.map((action, idx) => {
              const Icon = action.icon
              return (
                <motion.button
                  key={action.label}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.2, delay: idx * 0.05 }}
                  onClick={() => {
                    action.onClick()
                    setOpen(false)
                  }}
                  className="group inline-flex min-h-12 min-w-12 items-center justify-center gap-3 rounded-full border-2 border-border bg-background/95 px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={action.label}
                >
                  <Icon className="h-5 w-5 text-foreground" aria-hidden="true" />
                  <span className="text-foreground">{action.label}</span>
                </motion.button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-medical-primary text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <motion.span
          initial={false}
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Plus className="h-6 w-6" aria-hidden="true" />
        </motion.span>
      </motion.button>
    </div>
  )
}