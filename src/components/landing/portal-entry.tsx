"use client"

import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useMotionTemplate,
  useInView,
} from "framer-motion"
import Link from "next/link"
import {
  ArrowRight,
  ChevronDown,
  Calendar,
  BarChart3,
  Clock,
  Menu,
  X,
  CheckCircle2,
  Shield,
  Globe,
  Zap,
  Users,
  Layout,
  LogIn,
} from "lucide-react"
import React, { useState, useEffect, useRef } from "react"
import { useLenis } from "@/components/providers/lenis-provider"

// Custom cursor component
const CustomCursor = () => {
  const cursorX = useMotionValue(-100)
  const cursorY = useMotionValue(-100)
  const [isHovering, setIsHovering] = useState(false)
  const rafRef = useRef<number | null>(null)
  const lastUpdateRef = useRef<number>(0)

  // Smooth spring values for trailing effect
  const smoothX = useSpring(cursorX, { stiffness: 300, damping: 30 })
  const smoothY = useSpring(cursorY, { stiffness: 300, damping: 30 })

  useEffect(() => {
    // Check if device has fine pointer (mouse)
    const hasMouse = window.matchMedia("(pointer: fine)").matches
    if (!hasMouse) return

    const moveCursor = (e: MouseEvent) => {
      // Throttle to ~60fps using RAF
      const now = performance.now()
      if (now - lastUpdateRef.current < 16) return
      lastUpdateRef.current = now

      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        cursorX.set(e.clientX)
        cursorY.set(e.clientY)
      })
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const isInteractive = target.closest("a, button, [data-hover], input, select, textarea")
      setIsHovering(!!isInteractive)
    }

    // Use passive listeners for better scroll performance
    window.addEventListener("mousemove", moveCursor, { passive: true })
    window.addEventListener("mouseover", handleMouseOver, { passive: true })

    return () => {
      window.removeEventListener("mousemove", moveCursor)
      window.removeEventListener("mouseover", handleMouseOver)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [cursorX, cursorY])

  return (
    <>
      {/* Main cursor dot */}
      <motion.div
        className="fixed top-0 left-0 w-3 h-3 rounded-full bg-white pointer-events-none z-[9999] mix-blend-difference hidden md:block"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: "-50%",
          translateY: "-50%",
          willChange: "transform",
        }}
        animate={{
          scale: isHovering ? 2.5 : 1,
          opacity: isHovering ? 0.8 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      />
      {/* Trailing glow ring */}
      <motion.div
        className="fixed top-0 left-0 w-8 h-8 rounded-full border border-white/30 pointer-events-none z-[9998] hidden md:block"
        style={{
          x: smoothX,
          y: smoothY,
          translateX: "-50%",
          translateY: "-50%",
          willChange: "transform",
        }}
        animate={{
          scale: isHovering ? 1.5 : 1,
          opacity: isHovering ? 0.5 : 0.3,
        }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      />
    </>
  )
}

// Noise texture overlay - hidden on mobile for performance
const NoiseOverlay = React.memo(() => (
  <div
    className="fixed inset-0 pointer-events-none z-50 opacity-[0.02] hidden md:block"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
    }}
  />
))

// Logbook Background - Floating entries and structured grid (OPTIMIZED)
const LogbookBackground = React.memo(({ theme }: { theme: "orange" | "blue" }) => {
  const { scrollY } = useScroll()
  const backgroundY = useTransform(scrollY, [0, 1000], [0, 150])
  const bgRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(bgRef, { amount: 0.1 })

  const primaryColor = theme === "orange" ? "255, 107, 53" : "59, 130, 246" // rgb values
  const secondaryColor = theme === "orange" ? "255, 139, 94" : "99, 102, 241" // rgb values

  // Generate random floating cards - REDUCED from 12 to 6
  const cards = React.useMemo(() => {
    return [...Array(6)].map((_, i) => ({
      id: i,
      width: 120 + Math.random() * 100,
      height: 16 + Math.random() * 20,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 15 + Math.random() * 20,
      opacity: 0.05 + Math.random() * 0.1,
    }))
  }, [])

  return (
    <motion.div
      ref={bgRef}
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
      style={{ y: backgroundY }}
    >
      {/* Base - matches dashboard bg */}
      <div className="absolute inset-0 bg-[var(--theme-bg-color)]" />

      {/* Perspective Grid - Represents structure/schedule */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `
              linear-gradient(rgba(${primaryColor}, 0.4) 1px, transparent 1px),
              linear-gradient(90deg, rgba(${primaryColor}, 0.4) 1px, transparent 1px)
          `,
          backgroundSize: "100px 100px",
          transform: "perspective(1000px) rotateX(60deg) translateY(-100px) scale(2)",
          maskImage: "linear-gradient(to bottom, transparent, black 40%, black 80%, transparent)",
        }}
      />

      {/* Floating "Log Entries" - Only animate when in view */}
      <div className="absolute inset-0">
        {cards.map((card) => (
          <motion.div
            key={card.id}
            className="absolute rounded-md backdrop-blur-sm border border-white/10"
            style={{
              left: `${card.x}%`,
              top: `${card.y}%`,
              width: card.width,
              height: card.height,
              background: `linear-gradient(90deg, rgba(${primaryColor}, ${card.opacity}), rgba(${secondaryColor}, ${card.opacity / 2}))`,
              willChange: isInView ? "transform, opacity" : "auto",
            }}
            animate={isInView ? {
              y: [0, -100, 0],
              x: [0, 20, 0],
              opacity: [card.opacity, card.opacity * 1.5, card.opacity],
            } : {}}
            transition={{
              duration: card.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: card.delay,
            }}
          >
            {/* Fake text lines inside card */}
            <div className="w-3/4 h-1.5 bg-white/20 rounded-full mt-2 ml-2" />
            {card.height > 30 && <div className="w-1/2 h-1.5 bg-white/10 rounded-full mt-1.5 ml-2" />}
          </motion.div>
        ))}
      </div>

      {/* Ambient Glows - Use CSS animations for better performance */}
      <div
        className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full blur-[120px]"
        style={{
          background: `radial-gradient(circle, rgba(${primaryColor}, 0.1) 0%, transparent 70%)`,
          animation: isInView ? "ambientGlow1 10s ease-in-out infinite" : "none",
          willChange: isInView ? "transform, opacity" : "auto",
        }}
      />

      <div
        className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full blur-[100px]"
        style={{
          background: `radial-gradient(circle, rgba(${secondaryColor}, 0.08) 0%, transparent 70%)`,
          animation: isInView ? "ambientGlow2 12s ease-in-out 2s infinite" : "none",
          willChange: isInView ? "transform, opacity" : "auto",
        }}
      />

      {/* CSS animations for ambient glows */}
      <style>{`
        @keyframes ambientGlow1 {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.2); opacity: 0.5; }
        }
        @keyframes ambientGlow2 {
          0%, 100% { transform: scale(1); opacity: 0.2; }
          50% { transform: scale(1.1); opacity: 0.4; }
        }
      `}</style>
    </motion.div>
  )
})

// Magnetic button with hover effect
const MagneticButton = ({
  children,
  href,
  variant = "primary",
  theme = "orange",
}: {
  children: React.ReactNode
  href: string
  variant?: "primary" | "secondary"
  theme?: "orange" | "blue"
}) => {
  const ref = useRef<HTMLAnchorElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    x.set((e.clientX - centerX) * 0.15)
    y.set((e.clientY - centerY) * 0.15)
  }

  const handleMouseLeave = () => {
    x.set(0)
    y.set(0)
  }

  const springConfig = { stiffness: 150, damping: 15 }
  const springX = useSpring(x, springConfig)
  const springY = useSpring(y, springConfig)

  const primaryGradient =
    theme === "orange" ? "from-[#FF6B35] to-[#FF8B5E]" : "from-blue-600 to-indigo-600"

  const primaryShadow = theme === "orange" ? "shadow-[#FF6B35]/25" : "shadow-blue-600/25"

  const baseClasses =
    variant === "primary"
      ? `relative overflow-hidden bg-gradient-to-r ${primaryGradient} text-white font-medium px-8 py-4 rounded-full text-lg group shadow-lg ${primaryShadow}`
      : "relative overflow-hidden border border-white/10 bg-white/5 text-white font-medium px-8 py-4 rounded-full text-lg hover:bg-white/10 transition-all group backdrop-blur-md"

  return (
    <motion.a
      ref={ref}
      href={href}
      className={baseClasses}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      data-hover
    >
      {variant === "primary" && (
        <motion.div
          className={`absolute inset-0 bg-gradient-to-r ${primaryGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
        />
      )}
      {variant === "primary" && (
        <div className="absolute inset-0 bg-white/20 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300" />
      )}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.a>
  )
}

// Enhanced Spotlight Card with Depth
const SpotlightCard = ({
  children,
  className = "",
  theme = "orange",
}: {
  children: React.ReactNode
  className?: string
  theme?: "orange" | "blue"
}) => {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    mouseX.set(e.clientX - rect.left)
    mouseY.set(e.clientY - rect.top)
  }

  const spotlightColor = theme === "orange" ? "rgba(255, 107, 53, 0.1)" : "rgba(59, 130, 246, 0.1)"

  const background = useMotionTemplate`radial-gradient(500px circle at ${mouseX}px ${mouseY}px, ${spotlightColor}, transparent 80%)`

  return (
    <motion.div
      ref={ref}
      className={`group relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      whileHover={{
        y: -5,
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.5)",
      }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background }}
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  )
}

// Feature card with icon and hover effects
const FeatureCard = ({
  icon: Icon,
  number,
  title,
  description,
  delay = 0,
  theme = "orange",
}: {
  icon: any
  number: string
  title: string
  description: string
  delay?: number
  theme?: "orange" | "blue"
}) => {
  const iconColor = theme === "orange" ? "text-[#FF6B35]" : "text-blue-500"
  const iconBg = theme === "orange" ? "bg-[#FF6B35]/10" : "bg-blue-500/10"
  const iconBorder = theme === "orange" ? "border-[#FF6B35]/20" : "border-blue-500/20"

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      <SpotlightCard className="p-8 h-full" theme={theme}>
        <div className="flex flex-col h-full">
          <div
            className={`w-14 h-14 rounded-xl ${iconBg} ${iconBorder} border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}
          >
            <Icon className={`w-7 h-7 ${iconColor}`} />
          </div>

          <span className="text-xs font-mono text-white/40 tracking-wider mb-2 block">
            {number}
          </span>
          <h3 className="text-xl font-medium text-white mb-3 tracking-tight">{title}</h3>
          <p className="text-white/60 text-sm leading-relaxed">{description}</p>
        </div>
      </SpotlightCard>
    </motion.div>
  )
}

// Dashboard preview component
const DashboardPreview = ({ theme }: { theme: "orange" | "blue" }) => {
  const accentColor = theme === "orange" ? "#FF6B35" : "#3B82F6"

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotateX: 15 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 1, ease: [0.25, 0.4, 0.25, 1] }}
      className="relative mt-20"
      style={{ perspective: "1500px" }}
    >
      <div className="relative rounded-2xl border border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/10">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/[0.03]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-1 rounded-md bg-white/5 text-xs text-[var(--text-muted)] font-mono flex items-center gap-2">
              <Shield className="w-3 h-3 text-green-500" />
              dashboard.medstint.com
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-[300px] md:min-h-[400px]">
          {/* Sidebar mock - hidden on mobile */}
          <div className="hidden md:block md:col-span-2 space-y-3">
            <div className="h-8 rounded-lg bg-white/5" />
            <div className="h-6 rounded-lg bg-white/5 w-3/4" />
            <div className="h-6 rounded-lg bg-white/5 w-full" />
            <div className="h-6 rounded-lg bg-white/5 w-2/3" />
            <div className="h-6 rounded-lg bg-white/5 w-full" />
          </div>

          {/* Main content area */}
          <div className="col-span-1 md:col-span-10 space-y-4">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              {[
                { label: "Rotations", value: "24", color: "text-blue-400" },
                { label: "Students", value: "156", color: "text-green-400" },
                { label: "Sites", value: "12", color: "text-purple-400" },
                {
                  label: "Compliance",
                  value: "98%",
                  color: theme === "orange" ? "text-[#FF6B35]" : "text-blue-500",
                },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                  className={`p-4 rounded-xl bg-white/5 backdrop-blur-md border border-white/10`}
                >
                  <div className="text-2xl font-semibold text-white">{stat.value}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* Chart area */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 md:h-48">
              <div className="md:col-span-2 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-4">
                <div className="text-sm text-[var(--text-secondary)] mb-4">Activity Overview</div>
                <div className="flex items-end gap-2 h-24">
                  {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 50].map((h, i) => (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-t-sm opacity-80"
                      style={{
                        height: `${h}%`,
                        background:
                          theme === "orange"
                            ? `linear-gradient(to top, #FF6B35, #FF8B5E)`
                            : `linear-gradient(to top, #3B82F6, #60A5FA)`,
                      }}
                      initial={{ scaleY: 0 }}
                      whileInView={{ scaleY: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                    />
                  ))}
                </div>
              </div>
              <div className="hidden md:block rounded-xl bg-white/5 backdrop-blur-md border border-white/10 p-4">
                <div className="text-sm text-[var(--text-secondary)] mb-4">Quick Actions</div>
                <div className="space-y-2">
                  {["Add Rotation", "View Reports", "Schedule"].map((action, i) => (
                    <div
                      key={action}
                      className="h-10 rounded-lg bg-white/5 flex items-center px-3 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      <span className="text-xs text-[var(--text-muted)]">{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Glow effect */}
      <div
        className="absolute -inset-4 rounded-3xl blur-3xl -z-10 opacity-40"
        style={{
          background:
            theme === "orange"
              ? "linear-gradient(to right, #FF6B35, #9333EA)"
              : "linear-gradient(to right, #3B82F6, #8B5CF6)",
        }}
      />
    </motion.div>
  )
}

// Animated MS Book Logo Component
const Logo = ({ theme }: { theme: "orange" | "blue" }) => {
  const primaryColor = theme === "orange" ? "#FF6B35" : "#3B82F6"
  const secondaryColor = theme === "orange" ? "#FF8B5E" : "#6366F1"

  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg
        width="48"
        height="48"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g transform="translate(15, 15) scale(0.7)">
          {/* Left Page / M left leg */}
          <motion.path
            d="M10 10 L 50 35 L 50 85 L 10 60 Z"
            fill="none"
            stroke={primaryColor}
            strokeWidth="8"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, ease: "easeInOut" }}
          />

          {/* Right Page / M right leg */}
          <motion.path
            d="M90 10 L 50 35 L 50 85 L 90 60 Z"
            fill="none"
            stroke={secondaryColor}
            strokeWidth="8"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: "easeInOut" }}
          />

          {/* S Curve across pages */}
          <motion.path
            d="M10 35 L 50 60 L 90 35"
            fill="none"
            stroke={primaryColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
          />
          <motion.path
            d="M10 50 L 50 75 L 90 50"
            fill="none"
            stroke={secondaryColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.0, ease: "easeOut" }}
          />
        </g>
      </svg>
      <div
        className={`absolute inset-0 blur-xl opacity-40 bg-${theme === "orange" ? "orange" : "blue"}-500/30 rounded-lg`}
      />
    </div>
  )
}

// Scroll-aware Navbar with Premium Effects
const Navbar = ({
  theme,
  setMobileMenuOpen,
  mobileMenuOpen,
}: {
  theme: "orange" | "blue"
  setMobileMenuOpen: (open: boolean) => void
  mobileMenuOpen: boolean
}) => {
  const { scrollY } = useScroll()
  const { scrollTo } = useLenis()
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    return scrollY.on("change", (latest) => {
      setIsScrolled(latest > 50)
    })
  }, [scrollY])

  const navItems = ["Features", "Solutions", "Pricing", "About"]
  const primaryGradient =
    theme === "orange" ? "from-[#FF6B35] to-[#FF8B5E]" : "from-blue-500 to-indigo-500"
  const primaryShadow = theme === "orange" ? "shadow-[#FF6B35]/30" : "shadow-blue-500/30"

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ${isScrolled ? "py-3" : "py-4"
        }`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
    >
      {/* Navbar Container with Glassmorphism */}
      <div
        className={`mx-6 md:mx-12 rounded-2xl transition-all duration-500 ${isScrolled
          ? "bg-black/60 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/20"
          : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Logo with Glow Effect */}
          <Link href="/" className="flex items-center gap-3 group logo-glow" data-hover>
            <div className="relative">
              <Logo theme={theme} />
              {/* Subtle pulsing glow behind logo */}
              <motion.div
                className={`absolute inset-0 rounded-full ${theme === "orange" ? "bg-[#FF6B35]" : "bg-blue-500"} blur-xl opacity-0 group-hover:opacity-30`}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <span className="text-xl font-medium tracking-tight hidden sm:block">
              <span className="text-white group-hover:text-white/90 transition-colors">Med</span>
              <span
                className={`bg-gradient-to-r bg-clip-text text-transparent ${primaryGradient} animate-gradient`}
              >
                Stint
              </span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item, i) => (
              <motion.button
                key={item}
                onClick={() => scrollTo(`#${item.toLowerCase()}`, { offset: -100 })}
                className="relative px-4 py-2 text-sm text-white/70 hover:text-white transition-all duration-300 rounded-lg hover:bg-white/5 group nav-item-hover"
                data-hover
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.08 }}
                whileHover={{ y: -2 }}
              >
                <span className="relative z-10">{item}</span>
                {/* Animated underline */}
                <motion.span
                  className={`absolute bottom-1 left-4 right-4 h-0.5 bg-gradient-to-r ${primaryGradient} rounded-full origin-left`}
                  initial={{ scaleX: 0 }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.button>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center gap-3">
            {/* Sign In - Ghost Button */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Link
                href="/auth/sign-in"
                className="hidden md:flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white px-4 py-2.5 rounded-xl hover:bg-white/10 border border-transparent hover:border-white/10 transition-all duration-300"
                data-hover
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Link>
            </motion.div>

            {/* Get Started - Primary CTA with Shimmer */}
            <motion.div
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="hidden sm:block"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
            >
              <Link
                href="/auth/sign-up"
                className={`relative overflow-hidden flex items-center gap-2 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-lg ${primaryShadow} bg-gradient-to-r ${primaryGradient} transition-all duration-300 hover:shadow-xl btn-shimmer`}
                data-hover
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>

            {/* Mobile Menu Toggle */}
            <motion.button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300"
              aria-label="Toggle menu"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                animate={{ rotate: mobileMenuOpen ? 180 : 0 }}
                transition={{ duration: 0.3 }}
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5 text-white" />
                ) : (
                  <Menu className="w-5 h-5 text-white" />
                )}
              </motion.div>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.nav>
  )
}

// Main component
export const PortalEntry = () => {
  const [mounted, setMounted] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [theme, setTheme] = useState<"orange" | "blue">("orange")
  const heroRef = useRef<HTMLElement>(null)
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
  const heroScale = useTransform(scrollY, [0, 400], [1, 0.95])
  // Track hero visibility to pause animations when scrolled away
  const isHeroInView = useInView(heroRef, { amount: 0.1 })

  useEffect(() => {
    setMounted(true)
  }, [])

  const features = [
    {
      icon: Calendar,
      number: "01",
      title: "Smart Scheduling",
      description: "Automate clinical placements with AI-driven conflict resolution.",
    },
    {
      icon: BarChart3,
      number: "02",
      title: "Real-time Analytics",
      description: "Track student progress and site compliance instantly.",
    },
    {
      icon: Clock,
      number: "03",
      title: "Time Tracking",
      description: "GPS-verified attendance logging for accurate reporting.",
    },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.8, ease: "easeOut" as const },
    },
  }

  if (!mounted) return null

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[var(--theme-bg-color)] selection:bg-[var(--theme-color)]/30 selection:text-white">
      <CustomCursor />
      <NoiseOverlay />
      <LogbookBackground theme={theme} />

      {/* Theme Toggle (Temporary for testing) */}
      <div className="fixed bottom-6 right-6 z-50 flex gap-2 bg-black/50 backdrop-blur-md p-2 rounded-full border border-white/10">
        <button
          onClick={() => setTheme("orange")}
          className={`w-8 h-8 rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF8B5E] ${theme === "orange" ? "ring-2 ring-white" : "opacity-50"}`}
        />
        <button
          onClick={() => setTheme("blue")}
          className={`w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 ${theme === "blue" ? "ring-2 ring-white" : "opacity-50"}`}
        />
      </div>

      {/* Navigation */}
      <Navbar theme={theme} setMobileMenuOpen={setMobileMenuOpen} mobileMenuOpen={mobileMenuOpen} />

      {/* Mobile Menu Drawer with Stagger Animations */}
      <motion.div
        initial={false}
        animate={{
          opacity: mobileMenuOpen ? 1 : 0,
          y: mobileMenuOpen ? 0 : -20,
          pointerEvents: mobileMenuOpen ? "auto" : "none",
        }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed top-[80px] left-0 right-0 z-30 md:hidden"
      >
        <div className="mx-4 p-6 rounded-2xl mobile-menu-overlay shadow-2xl">
          <div className="flex flex-col gap-2">
            {["Features", "Solutions", "Pricing", "About"].map((item, i) => (
              <motion.button
                key={item}
                onClick={() => {
                  document
                    .getElementById(item.toLowerCase())
                    ?.scrollIntoView({ behavior: "smooth" })
                  setMobileMenuOpen(false)
                }}
                className="group flex items-center justify-between text-left text-lg text-white/80 hover:text-white py-4 px-4 rounded-xl hover:bg-white/5 border-b border-white/5 transition-all duration-300"
                initial={{ opacity: 0, x: -20 }}
                animate={{
                  opacity: mobileMenuOpen ? 1 : 0,
                  x: mobileMenuOpen ? 0 : -20,
                }}
                transition={{ delay: mobileMenuOpen ? 0.1 + i * 0.08 : 0, duration: 0.3 }}
              >
                <span className="font-medium">{item}</span>
                <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all" />
              </motion.button>
            ))}

            {/* Divider */}
            <div className="my-2 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Sign In Button */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: mobileMenuOpen ? 1 : 0,
                x: mobileMenuOpen ? 0 : -20,
              }}
              transition={{ delay: mobileMenuOpen ? 0.4 : 0, duration: 0.3 }}
            >
              <Link
                href="/auth/sign-in"
                className="flex items-center gap-3 text-lg text-white/80 hover:text-white py-4 px-4 rounded-xl hover:bg-white/5 transition-all duration-300"
                onClick={() => setMobileMenuOpen(false)}
              >
                <LogIn className="w-5 h-5" />
                <span className="font-medium">Sign In</span>
              </Link>
            </motion.div>

            {/* Get Started CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{
                opacity: mobileMenuOpen ? 1 : 0,
                y: mobileMenuOpen ? 0 : 10,
              }}
              transition={{ delay: mobileMenuOpen ? 0.5 : 0, duration: 0.3 }}
            >
              <Link
                href="/auth/sign-up"
                className={`mt-2 flex items-center justify-center gap-2 text-white px-6 py-4 rounded-xl text-center font-semibold shadow-lg btn-shimmer ${theme === "orange"
                  ? "bg-gradient-to-r from-[#FF6B35] to-[#FF8B5E] shadow-[#FF6B35]/30"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-600/30"
                  }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Hero Section - Wide Landscape Layout */}
      <motion.section
        ref={heroRef}
        className="relative h-screen flex items-center justify-center px-6 md:px-12 lg:px-24"
        style={{ opacity: heroOpacity, scale: heroScale }}
      >
        {/* Floating Color Orbs - Use CSS animations for performance */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className={`absolute w-[500px] h-[500px] md:w-[800px] md:h-[800px] rounded-full blur-[150px] opacity-30 ${theme === "orange" ? "bg-[#FF6B35]" : "bg-blue-500"
              }`}
            style={{
              top: "10%",
              left: "10%",
              animation: isHeroInView ? "floatOrb1 15s ease-in-out infinite" : "none",
              willChange: isHeroInView ? "transform" : "auto",
            }}
          />
          <div
            className={`absolute w-[400px] h-[400px] md:w-[600px] md:h-[600px] rounded-full blur-[120px] opacity-25 ${theme === "orange" ? "bg-[#FF8B5E]" : "bg-indigo-500"
              }`}
            style={{
              top: "30%",
              right: "5%",
              animation: isHeroInView ? "floatOrb2 18s ease-in-out 2s infinite" : "none",
              willChange: isHeroInView ? "transform" : "auto",
            }}
          />
          <div
            className="absolute w-[350px] h-[350px] md:w-[500px] md:h-[500px] rounded-full blur-[100px] opacity-20 bg-purple-500"
            style={{
              bottom: "10%",
              left: "40%",
              animation: isHeroInView ? "floatOrb3 12s ease-in-out 1s infinite" : "none",
              willChange: isHeroInView ? "transform" : "auto",
            }}
          />
          {/* CSS animations for floating orbs */}
          <style>{`
            @keyframes floatOrb1 {
              0%, 100% { transform: translate(0, 0) scale(1); }
              50% { transform: translate(80px, -50px) scale(1.15); }
            }
            @keyframes floatOrb2 {
              0%, 100% { transform: translate(0, 0) scale(1); }
              50% { transform: translate(-60px, 60px) scale(0.85); }
            }
            @keyframes floatOrb3 {
              0%, 100% { transform: translate(0, 0); }
              50% { transform: translate(40px, -30px); }
            }
          `}</style>
        </div>

        {/* Centered Clock Layout */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col items-center justify-center"
        >
          {/* Clock with Dissolving Portal Effect - Centered */}
          <motion.div variants={itemVariants} className="flex justify-center">
            <Link href="/auth/sign-in" className="group relative" data-hover>
              {/* Multi-layer background glow */}
              <motion.div
                className={`absolute -inset-32 rounded-full blur-[150px] ${theme === "orange" ? "bg-[#FF6B35]" : "bg-blue-500"
                  } opacity-10 group-hover:opacity-50 transition-all duration-1000`}
              />
              <motion.div className="absolute -inset-24 rounded-full blur-[100px] bg-white/5 group-hover:bg-white/20 transition-all duration-700" />

              {/* PARTICLES - OPTIMIZED: Reduced count and visibility-aware */}
              <div className="absolute inset-0 pointer-events-none overflow-visible">
                {/* Primary particles - REDUCED from 24 to 8 for performance */}
                {[...Array(8)].map((_, i) => {
                  const angle = i * 45 * (Math.PI / 180) // 360/8 = 45 degrees apart
                  const clockRadius = 160
                  const endRadius = 400 + (i % 4) * 100
                  return (
                    <motion.div
                      key={`space-particle-${i}`}
                      className={`absolute rounded-full ${theme === "orange"
                        ? i % 4 === 0
                          ? "bg-[#FF6B35] w-2 h-2 md:w-3 md:h-3"
                          : i % 4 === 1
                            ? "bg-[#FF8B5E] w-1.5 h-1.5 md:w-2 md:h-2"
                            : i % 4 === 2
                              ? "bg-white/70 w-1 h-1 md:w-1.5 md:h-1.5"
                              : "bg-white/40 w-1 h-1"
                        : i % 4 === 0
                          ? "bg-blue-500 w-2 h-2 md:w-3 md:h-3"
                          : i % 4 === 1
                            ? "bg-indigo-400 w-1.5 h-1.5 md:w-2 md:h-2"
                            : i % 4 === 2
                              ? "bg-white/70 w-1 h-1 md:w-1.5 md:h-1.5"
                              : "bg-white/40 w-1 h-1"
                        } opacity-80 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300`}
                      style={{
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        willChange: isHeroInView ? "transform" : "auto",
                      }}
                      animate={isHeroInView ? {
                        x: [Math.cos(angle) * clockRadius, Math.cos(angle) * endRadius],
                        y: [Math.sin(angle) * clockRadius, Math.sin(angle) * endRadius],
                        scale: [1, 0.3],
                      } : {}}
                      transition={{
                        duration: 5 + (i % 4) * 0.5,
                        repeat: Infinity,
                        delay: i * 0.2,
                        ease: "linear",
                      }}
                    />
                  )
                })}

                {/* Larger depth particles - REDUCED from 12 to 4 */}
                {[...Array(4)].map((_, i) => {
                  const angle = i * 90 * (Math.PI / 180) // 360/4 = 90 degrees apart
                  const clockRadius = 220
                  const endRadius = 600 + (i % 3) * 180
                  return (
                    <motion.div
                      key={`slow-particle-${i}`}
                      className={`absolute rounded-full ${theme === "orange" ? "bg-[#FF6B35]/50" : "bg-blue-500/50"
                        } w-3 h-3 md:w-4 md:h-4 blur-[1px] hidden md:block md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300`}
                      style={{
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        willChange: isHeroInView ? "transform" : "auto",
                      }}
                      animate={isHeroInView ? {
                        x: [Math.cos(angle) * clockRadius, Math.cos(angle) * endRadius],
                        y: [Math.sin(angle) * clockRadius, Math.sin(angle) * endRadius],
                        scale: [1, 0.2],
                      } : {}}
                      transition={{
                        duration: 7 + (i % 4) * 1,
                        repeat: Infinity,
                        delay: 0.5 + i * 0.3,
                        ease: "linear",
                      }}
                    />
                  )
                })}
              </div>

              {/* Premium Glass Clock Container - OPTIMIZED with visibility control */}
              <motion.div
                className="relative w-[300px] h-[300px] md:w-[420px] md:h-[420px] lg:w-[500px] lg:h-[500px] rounded-full border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl flex items-center justify-center shadow-2xl cursor-pointer group-hover:border-white/25 transition-all duration-500"
                style={{
                  boxShadow: "inset 0 0 60px rgba(255,255,255,0.03), 0 0 80px rgba(0,0,0,0.3)",
                  willChange: isHeroInView ? "transform" : "auto",
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={isHeroInView ? {
                  scale: [1, 1.005, 1], // Subtle breathing
                } : {}}
                transition={{
                  scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
                }}
              >
                {/* Animated outer glow ring - breathing effect */}
                <motion.div
                  className={`absolute -inset-2 rounded-full blur-2xl ${theme === "orange" ? "bg-[#FF6B35]" : "bg-blue-500"}`}
                  animate={isHeroInView ? {
                    opacity: [0.05, 0.15, 0.05],
                    scale: [0.98, 1.02, 0.98],
                  } : { opacity: 0.1, scale: 1 }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* Inner shimmer effect */}
                <motion.div
                  className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent"
                  animate={isHeroInView ? {
                    rotate: [0, 360],
                  } : {}}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />

                {/* Clock rings - REMOVED breathing animations for performance (very subtle effect) */}
                <div className="absolute inset-4 md:inset-6 rounded-full border border-white/[0.08] group-hover:border-white/[0.03] transition-all duration-700" />
                <div className="absolute inset-10 md:inset-14 rounded-full border border-white/[0.06] group-hover:border-white/[0.02] transition-all duration-700" />
                <div className="absolute inset-16 md:inset-22 rounded-full border border-white/[0.04] group-hover:border-white/[0.01] transition-all duration-700" />
                <div className="absolute inset-24 md:inset-32 rounded-full border border-white/[0.03] group-hover:opacity-0 transition-all duration-700" />

                {/* Minutes tick marks (60 marks) - fade in sequentially */}
                {[...Array(60)].map((_, i) => {
                  if (i % 5 === 0) return null
                  const angle = (i * 6 - 90) * (Math.PI / 180)
                  const radius = 135
                  const x = Math.cos(angle) * radius
                  const y = Math.sin(angle) * radius
                  return (
                    <motion.div
                      key={`tick-${i}`}
                      className="absolute w-[2px] h-[6px] md:w-[2px] md:h-[8px] bg-white/10 group-hover:opacity-30 transition-all duration-500"
                      style={{
                        left: "50%",
                        top: "50%",
                        marginLeft: `${x}px`,
                        marginTop: `${y}px`,
                        transform: `translate(-50%, -50%) rotate(${i * 6}deg)`,
                      }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.1 }}
                      transition={{ delay: i * 0.02, duration: 0.5 }}
                    />
                  )
                })}

                {/* Hour markers - OPTIMIZED with visibility control */}
                {[...Array(12)].map((_, i) => {
                  const angle = (i * 30 - 90) * (Math.PI / 180)
                  const radius = 130
                  const x = Math.cos(angle) * radius
                  const y = Math.sin(angle) * radius
                  const isMajor = i % 3 === 0
                  return (
                    <motion.div
                      key={i}
                      className={`absolute rounded-full transition-all duration-500 ${isMajor
                        ? `w-3 h-3 md:w-4 md:h-4 ${theme === "orange" ? "bg-[#FF6B35]/50 group-hover:bg-[#FF6B35]/30" : "bg-blue-500/50 group-hover:bg-blue-500/30"}`
                        : "w-2 h-2 md:w-2.5 md:h-2.5 bg-white/30 group-hover:bg-white/15"
                        }`}
                      style={{
                        left: "50%",
                        top: "50%",
                        marginLeft: `${x}px`,
                        marginTop: `${y}px`,
                        transform: "translate(-50%, -50%)",
                        boxShadow: isMajor
                          ? `0 0 15px ${theme === "orange" ? "rgba(255,107,53,0.4)" : "rgba(59,130,246,0.4)"}`
                          : "none",
                      }}
                      animate={isHeroInView ? (
                        isMajor
                          ? {
                            scale: [1, 1.15, 1],
                            opacity: [0.5, 0.8, 0.5],
                          }
                          : {
                            y: [0, -2, 0],
                          }
                      ) : {}}
                      transition={{
                        duration: isMajor ? 2.5 : 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: i * 0.15,
                      }}
                    />
                  )
                })}

                {/* Hour hand - OPTIMIZED with visibility control */}
                <motion.div
                  className={`absolute left-1/2 top-1/2 w-2 md:w-2.5 h-[70px] md:h-[100px] lg:h-[120px] rounded-full -translate-x-1/2 origin-top ${theme === "orange"
                    ? "bg-gradient-to-b from-[#FF6B35] via-[#FF6B35]/60 to-[#FF6B35]/20"
                    : "bg-gradient-to-b from-blue-500 via-blue-500/60 to-blue-500/20"
                    } group-hover:opacity-20 shadow-lg transition-all duration-700`}
                  style={{
                    boxShadow: `0 0 15px ${theme === "orange" ? "rgba(255,107,53,0.4)" : "rgba(59,130,246,0.4)"}`,
                  }}
                  animate={isHeroInView ? { rotate: 360 } : {}}
                  transition={{ duration: 43200, repeat: Infinity, ease: "linear" }}
                />

                {/* Minute hand - OPTIMIZED */}
                <motion.div
                  className={`absolute left-1/2 top-1/2 w-1.5 md:w-2 h-[90px] md:h-[140px] lg:h-[170px] rounded-full -translate-x-1/2 origin-top ${theme === "orange"
                    ? "bg-gradient-to-b from-[#FF8B5E] via-[#FF8B5E]/40 to-transparent"
                    : "bg-gradient-to-b from-indigo-400 via-indigo-400/40 to-transparent"
                    } group-hover:opacity-15 transition-all duration-700`}
                  animate={isHeroInView ? { rotate: 360 } : {}}
                  transition={{ duration: 3600, repeat: Infinity, ease: "linear" }}
                />

                {/* Second hand - OPTIMIZED */}
                <motion.div
                  className="absolute left-1/2 top-1/2 w-[2px] md:w-[3px] h-[95px] md:h-[150px] lg:h-[180px] -translate-x-1/2 origin-top group-hover:opacity-10 transition-all duration-700"
                  style={{
                    background:
                      "linear-gradient(to bottom, rgba(255,255,255,0.9), rgba(255,255,255,0.3), transparent)",
                  }}
                  animate={isHeroInView ? { rotate: 360 } : {}}
                  transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                />

                {/* Center dot - OPTIMIZED */}
                <motion.div
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 md:w-6 md:h-6 rounded-full ${theme === "orange" ? "bg-[#FF6B35]" : "bg-blue-500"
                    } group-hover:opacity-30 transition-all duration-700 z-10`}
                  animate={isHeroInView ? {
                    boxShadow: [
                      `0 0 20px ${theme === "orange" ? "rgba(255,107,53,0.5)" : "rgba(59,130,246,0.5)"}, 0 0 40px ${theme === "orange" ? "rgba(255,107,53,0.2)" : "rgba(59,130,246,0.2)"}`,
                      `0 0 30px ${theme === "orange" ? "rgba(255,107,53,0.7)" : "rgba(59,130,246,0.7)"}, 0 0 60px ${theme === "orange" ? "rgba(255,107,53,0.4)" : "rgba(59,130,246,0.4)"}`,
                      `0 0 20px ${theme === "orange" ? "rgba(255,107,53,0.5)" : "rgba(59,130,246,0.5)"}, 0 0 40px ${theme === "orange" ? "rgba(255,107,53,0.2)" : "rgba(59,130,246,0.2)"}`,
                    ],
                  } : {}}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                {/* Center white dot - OPTIMIZED */}
                <motion.div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 md:w-3 md:h-3 rounded-full bg-white group-hover:opacity-30 transition-all duration-700 z-20"
                  animate={isHeroInView ? {
                    scale: [1, 1.2, 1],
                  } : {}}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* ENHANCED PORTAL - OPTIMIZED with visibility control */}
                <motion.div
                  className="absolute w-32 h-32 md:w-48 md:h-48 lg:w-56 lg:h-56 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center"
                  style={{
                    background:
                      theme === "orange"
                        ? "radial-gradient(circle, rgba(255,107,53,0.9) 0%, rgba(255,139,94,0.4) 35%, rgba(255,107,53,0.1) 60%, transparent 80%)"
                        : "radial-gradient(circle, rgba(59,130,246,0.9) 0%, rgba(99,102,241,0.4) 35%, rgba(59,130,246,0.1) 60%, transparent 80%)",
                  }}
                  animate={isHeroInView ? {
                    scale: [1, 1.08, 1],
                  } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  {/* Multi-layer portal glow */}
                  <motion.div
                    className="absolute w-24 h-24 md:w-36 md:h-36 rounded-full bg-white/10 blur-md"
                    animate={isHeroInView ? {
                      scale: [1, 1.3, 1],
                      opacity: [0.2, 0.4, 0.2],
                    } : {}}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />

                  {/* Pulsing rings - use CSS animation with visibility control */}
                  <div
                    className={`absolute w-24 h-24 md:w-36 md:h-36 rounded-full border-2 ${theme === "orange" ? "border-[#FF6B35]" : "border-blue-400"
                      }`}
                    style={{
                      animation: isHeroInView ? "pulseRing 2.4s ease-out infinite" : "none",
                    }}
                  />
                  <div
                    className={`absolute w-20 h-20 md:w-28 md:h-28 rounded-full border ${theme === "orange" ? "border-[#FF8B5E]" : "border-indigo-400"
                      }`}
                    style={{
                      animation: isHeroInView ? "pulseRing 2.4s ease-out infinite 0.8s" : "none",
                    }}
                  />
                  <div
                    className="absolute w-16 h-16 md:w-20 md:h-20 rounded-full border border-white/50"
                    style={{
                      animation: isHeroInView ? "pulseRing 2.4s ease-out infinite 1.6s" : "none",
                    }}
                  />
                  <style>{`
                                        @keyframes pulseRing {
                                            0% {
                                                transform: scale(0.2);
                                                opacity: 0.8;
                                            }
                                            100% {
                                                transform: scale(1.5);
                                                opacity: 0;
                                            }
                                        }
                                    `}</style>

                  {/* Bright pulsing core */}
                  <motion.div
                    className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.5)]"
                    animate={isHeroInView ? {
                      scale: [1, 1.1, 1],
                      boxShadow: [
                        "0 0 40px rgba(255,255,255,0.5)",
                        "0 0 70px rgba(255,255,255,0.8)",
                        "0 0 40px rgba(255,255,255,0.5)",
                      ],
                    } : {}}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  >
                    <LogIn className="w-5 h-5 md:w-6 md:h-6 text-black" />
                  </motion.div>
                </motion.div>

                {/* ENTER text - visible on mobile */}
                <motion.span className="absolute bottom-16 md:bottom-24 text-white/60 md:text-white/0 md:group-hover:text-white/70 text-xs md:text-sm font-medium tracking-[0.4em] uppercase transition-all duration-700">
                  Enter Portal
                </motion.span>
              </motion.div>
            </Link>
          </motion.div>

          {/* Subtle hint text */}
          <motion.p
            variants={itemVariants}
            className="mt-8 text-white/30 md:text-white/20 text-xs md:text-sm tracking-wide"
          >
            <span className="md:hidden">Tap to enter</span>
            <span className="hidden md:inline">Hover to activate · Click to enter</span>
          </motion.p>
        </motion.div>

        {/* Scroll hint */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 2.5 }}
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="w-6 h-6 text-white/20" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* Features Section - Dashboard Preview */}
      <section id="features" className="relative py-24 px-6 md:px-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-light text-white mb-6">
              Powerful simplicity.
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Designed for clarity and speed. Everything you need to manage clinical rotations is
              right at your fingertips.
            </p>
          </div>
          <DashboardPreview theme={theme} />
        </div>
      </section>

      {/* Solutions Section - User Roles */}
      <section id="solutions" className="relative py-20 md:py-28 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <motion.p
            className="text-center text-white/40 text-sm uppercase tracking-widest mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Built for everyone
          </motion.p>

          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.1 } },
            }}
          >
            {/* School Admin */}
            <motion.div
              className="text-center group"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
              }}
            >
              <div
                className={`w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${theme === "orange"
                  ? "bg-[#FF6B35]/10 border border-[#FF6B35]/20"
                  : "bg-blue-500/10 border border-blue-500/20"
                  } group-hover:scale-110 transition-transform duration-300`}
              >
                <Layout
                  className={`w-6 h-6 md:w-7 md:h-7 ${theme === "orange" ? "text-[#FF6B35]" : "text-blue-400"}`}
                />
              </div>
              <h3 className="text-white font-medium text-sm md:text-base mb-1">School Admin</h3>
              <p className="text-white/40 text-xs md:text-sm">Manage programs</p>
            </motion.div>

            {/* Preceptor */}
            <motion.div
              className="text-center group"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
              }}
            >
              <div
                className={`w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${theme === "orange"
                  ? "bg-[#FF8B5E]/10 border border-[#FF8B5E]/20"
                  : "bg-indigo-500/10 border border-indigo-500/20"
                  } group-hover:scale-110 transition-transform duration-300`}
              >
                <Users
                  className={`w-6 h-6 md:w-7 md:h-7 ${theme === "orange" ? "text-[#FF8B5E]" : "text-indigo-400"}`}
                />
              </div>
              <h3 className="text-white font-medium text-sm md:text-base mb-1">Preceptor</h3>
              <p className="text-white/40 text-xs md:text-sm">Guide students</p>
            </motion.div>

            {/* Supervisor */}
            <motion.div
              className="text-center group"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
              }}
            >
              <div
                className={`w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${theme === "orange"
                  ? "bg-[#FFB088]/10 border border-[#FFB088]/20"
                  : "bg-purple-500/10 border border-purple-500/20"
                  } group-hover:scale-110 transition-transform duration-300`}
              >
                <Shield
                  className={`w-6 h-6 md:w-7 md:h-7 ${theme === "orange" ? "text-[#FFB088]" : "text-purple-400"}`}
                />
              </div>
              <h3 className="text-white font-medium text-sm md:text-base mb-1">Supervisor</h3>
              <p className="text-white/40 text-xs md:text-sm">Evaluate progress</p>
            </motion.div>

            {/* Student */}
            <motion.div
              className="text-center group"
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
              }}
            >
              <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 group-hover:scale-110 transition-transform duration-300">
                <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7 text-white/70" />
              </div>
              <h3 className="text-white font-medium text-sm md:text-base mb-1">Student</h3>
              <p className="text-white/40 text-xs md:text-sm">Track rotations</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Pricing / CTA Section */}
      <section id="pricing" className="relative py-24 px-6 md:px-12 overflow-hidden">
        <div
          className={`absolute inset-0 opacity-20 bg-gradient-to-b ${theme === "orange" ? "from-[#FF6B35]/20" : "from-blue-600/20"} to-transparent`}
        />
        <motion.div
          className="max-w-3xl mx-auto text-center relative z-10"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl md:text-5xl font-light text-white tracking-tight mb-8">
            Ready to start?
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <MagneticButton href="/auth/sign-up" variant="primary" theme={theme}>
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </MagneticButton>
          </div>
        </motion.div>
      </section>

      {/* About / Footer */}
      <footer id="about" className="relative border-t border-white/10 py-12 px-6 md:px-12 bg-black/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === "orange" ? "bg-gradient-to-br from-[#FF6B35] to-[#FF8B5E]" : "bg-gradient-to-br from-blue-600 to-indigo-600"}`}
                >
                  <span className="font-bold text-white text-sm">M</span>
                </div>
                <span className="text-white font-medium">MedStint</span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed">
                Empowering clinical education with modern tools for modern healthcare.
              </p>
            </div>

            {[
              { title: "Product", links: ["Features", "Pricing", "Security", "Roadmap"] },
              { title: "Company", links: ["About", "Careers", "Blog", "Contact"] },
              { title: "Legal", links: ["Privacy", "Terms", "Cookie Policy"] },
            ].map((column) => (
              <div key={column.title} className="col-span-1">
                <h4 className="text-white font-medium mb-4">{column.title}</h4>
                <ul className="space-y-3">
                  {column.links.map((link) => (
                    <li key={link}>
                      <Link
                        href="#"
                        className="text-white/40 hover:text-white text-sm transition-colors"
                      >
                        {link}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-[var(--text-muted)] text-sm">
              © 2025 MedStint Inc. All rights reserved.
            </span>
            <div className="flex items-center gap-6">
              <Link href="#" className="text-white/40 hover:text-white transition-colors">
                <Users className="w-5 h-5" />
              </Link>
              <Link href="#" className="text-white/40 hover:text-white transition-colors">
                <Globe className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
