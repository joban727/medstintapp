"use client"

import dynamic from "next/dynamic"

// Dynamic imports for framer-motion to prevent SSR issues
const MotionDiv = dynamic(() => import("framer-motion").then((mod) => mod.motion.div), {
  ssr: false,
  loading: () => <div />,
})

const MotionFigure = dynamic(() => import("framer-motion").then((mod) => mod.motion.figure), {
  ssr: false,
  loading: () => <figure />,
})

const AnimatePresence = dynamic(() => import("framer-motion").then((mod) => mod.AnimatePresence), {
  ssr: false,
  loading: () => <></>,
})

// Export motion components with proper typing
export const motion = {
  div: MotionDiv as React.ComponentType<React.HTMLAttributes<HTMLDivElement> & any>,
  figure: MotionFigure as React.ComponentType<React.HTMLAttributes<HTMLElement> & any>,
}

export { AnimatePresence }

// Re-export common framer-motion types
export type { Transition, Variants } from "framer-motion"
