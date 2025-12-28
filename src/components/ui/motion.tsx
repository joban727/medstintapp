"use client"

import dynamic from "next/dynamic"

// Dynamic imports for framer-motion to prevent SSR issues
const MotionDiv = dynamic(() => import("framer-motion").then((mod) => mod.motion.div), {
  ssr: false,
  loading: () => <div />,
})

const MotionSection = dynamic(() => import("framer-motion").then((mod) => mod.motion.section), {
  ssr: false,
  loading: () => <section />,
})

const MotionH1 = dynamic(() => import("framer-motion").then((mod) => mod.motion.h1), {
  ssr: false,
  loading: () => <h1 />,
})

const MotionP = dynamic(() => import("framer-motion").then((mod) => mod.motion.p), {
  ssr: false,
  loading: () => <p />,
})

const MotionSpan = dynamic(() => import("framer-motion").then((mod) => mod.motion.span), {
  ssr: false,
  loading: () => <span />,
})

const MotionFigure = dynamic(() => import("framer-motion").then((mod) => mod.motion.figure), {
  ssr: false,
  loading: () => <figure />,
})

const MotionUl = dynamic(() => import("framer-motion").then((mod) => mod.motion.ul), {
  ssr: false,
  loading: () => <ul />,
})

const MotionLi = dynamic(() => import("framer-motion").then((mod) => mod.motion.li), {
  ssr: false,
  loading: () => <li />,
})

const AnimatePresence = dynamic(() => import("framer-motion").then((mod) => mod.AnimatePresence), {
  ssr: false,
  loading: () => <></>,
})

// Export motion components with proper typing
export const motion = {
  div: MotionDiv as React.ComponentType<React.HTMLAttributes<HTMLDivElement> & any>,
  section: MotionSection as React.ComponentType<React.HTMLAttributes<HTMLElement> & any>,
  h1: MotionH1 as React.ComponentType<React.HTMLAttributes<HTMLHeadingElement> & any>,
  p: MotionP as React.ComponentType<React.HTMLAttributes<HTMLParagraphElement> & any>,
  span: MotionSpan as React.ComponentType<React.HTMLAttributes<HTMLSpanElement> & any>,
  figure: MotionFigure as React.ComponentType<React.HTMLAttributes<HTMLElement> & any>,
  ul: MotionUl as React.ComponentType<React.HTMLAttributes<HTMLUListElement> & any>,
  li: MotionLi as React.ComponentType<React.HTMLAttributes<HTMLLIElement> & any>,
}

export { AnimatePresence }

// Re-export common framer-motion types
export type { Transition, Variants } from "framer-motion"
