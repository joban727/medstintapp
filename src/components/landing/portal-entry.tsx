"use client"

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Sparkles, Moon, Sun, Stethoscope, ClipboardList, Heart, Activity, Pill, FileText } from "lucide-react"
import { useRef, useState, useEffect } from "react"
import { useTheme } from "next-themes"

// Typewriter effect hook
const useTypewriter = (text: string, speed: number = 50, delay: number = 500) => {
    const [displayText, setDisplayText] = useState("")
    const [isComplete, setIsComplete] = useState(false)

    useEffect(() => {
        setDisplayText("")
        setIsComplete(false)

        const timeout = setTimeout(() => {
            let i = 0
            const interval = setInterval(() => {
                if (i < text.length) {
                    setDisplayText(text.slice(0, i + 1))
                    i++
                } else {
                    setIsComplete(true)
                    clearInterval(interval)
                }
            }, speed)
            return () => clearInterval(interval)
        }, delay)

        return () => clearTimeout(timeout)
    }, [text, speed, delay])

    return { displayText, isComplete }
}

// Floating medical icons data
const floatingIcons = [
    { Icon: Stethoscope, delay: 0, x: "10%", y: "20%" },
    { Icon: ClipboardList, delay: 1.5, x: "85%", y: "15%" },
    { Icon: Heart, delay: 0.8, x: "15%", y: "70%" },
    { Icon: Activity, delay: 2.2, x: "80%", y: "65%" },
    { Icon: Pill, delay: 1.2, x: "5%", y: "45%" },
    { Icon: FileText, delay: 2.8, x: "90%", y: "40%" },
]

export const PortalEntry = () => {
    const containerRef = useRef<HTMLDivElement>(null)
    const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })
    const [isMobile, setIsMobile] = useState(false)
    const [mounted, setMounted] = useState(false)
    const { theme, setTheme } = useTheme()

    // Typewriter effect for tagline
    const { displayText, isComplete } = useTypewriter(
        "Seamlessly manage rotations, track competencies, and ensure compliance.",
        30,
        1000
    )

    useEffect(() => {
        setMounted(true)
    }, [])

    // Check for mobile on mount
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Mouse position tracking for blobs (desktop only)
    const mouseX = useMotionValue(0.5)
    const mouseY = useMotionValue(0.5)

    // Smooth spring animation for mouse movement
    const springConfig = { damping: 25, stiffness: 120 }
    const smoothMouseX = useSpring(mouseX, springConfig)
    const smoothMouseY = useSpring(mouseY, springConfig)

    // Subtle blob movement
    const blobRange = isMobile ? 15 : 40
    const blob1X = useTransform(smoothMouseX, [0, 1], [-blobRange, blobRange])
    const blob1Y = useTransform(smoothMouseY, [0, 1], [-blobRange, blobRange])
    const blob2X = useTransform(smoothMouseX, [0, 1], [blobRange * 0.6, -blobRange * 0.6])
    const blob2Y = useTransform(smoothMouseY, [0, 1], [blobRange * 0.6, -blobRange * 0.6])

    // Subtle card tilt (desktop only)
    const cardRotateX = useTransform(smoothMouseY, [0, 1], isMobile ? [0, 0] : [2, -2])
    const cardRotateY = useTransform(smoothMouseX, [0, 1], isMobile ? [0, 0] : [-2, 2])

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current || isMobile) return
        const rect = containerRef.current.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width
        const y = (e.clientY - rect.top) / rect.height
        mouseX.set(x)
        mouseY.set(y)
        setCursorPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }

    return (
        <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            className="min-h-screen min-h-[100dvh] w-full flex flex-col lg:flex-row bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden selection:bg-teal-500/20"
            style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
        >
            {/* Theme Toggle Button */}
            {mounted && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5, duration: 0.3 }}
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 p-2.5 sm:p-3 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-lg backdrop-blur-sm hover:scale-110 hover:shadow-xl transition-all duration-300 group"
                    aria-label="Toggle theme"
                >
                    <motion.div
                        initial={false}
                        animate={{ rotate: theme === 'dark' ? 180 : 0 }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                    >
                        {theme === 'dark' ? (
                            <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 group-hover:text-amber-400" />
                        ) : (
                            <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 group-hover:text-slate-800" />
                        )}
                    </motion.div>
                </motion.button>
            )}

            {/* Subtle cursor glow - Desktop only */}
            {!isMobile && (
                <div
                    className="pointer-events-none fixed z-40 w-[400px] h-[400px] rounded-full opacity-15 blur-[80px] transition-opacity duration-500 hidden lg:block"
                    style={{
                        background: 'radial-gradient(circle, rgba(20,184,166,0.4) 0%, transparent 70%)',
                        left: cursorPosition.x - 200,
                        top: cursorPosition.y - 200,
                    }}
                />
            )}

            {/* Elegant Minimal Background */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                {/* Soft ambient gradients */}
                <motion.div
                    style={{ x: blob1X, y: blob1Y }}
                    className="absolute top-[-30%] left-[-20%] w-[80%] h-[80%] bg-teal-100/25 dark:bg-teal-900/15 rounded-full blur-[200px]"
                />
                <motion.div
                    style={{ x: blob2X, y: blob2Y }}
                    className="absolute bottom-[-30%] right-[-20%] w-[80%] h-[80%] bg-slate-200/30 dark:bg-slate-800/25 rounded-full blur-[200px]"
                />

                {/* Subtle scanning line */}
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-teal-500/40 to-transparent animate-xray-scan opacity-50" />

                {/* Fine grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.012] dark:opacity-[0.015]"
                    style={{
                        backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
                        backgroundSize: '60px 60px'
                    }}
                />

                {/* Floating Medical Icons */}
                {!isMobile && floatingIcons.map(({ Icon, delay, x, y }, index) => (
                    <motion.div
                        key={index}
                        className="absolute hidden lg:block"
                        style={{ left: x, top: y }}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{
                            opacity: [0.1, 0.25, 0.1],
                            scale: [0.8, 1, 0.8],
                            y: [0, -20, 0],
                        }}
                        transition={{
                            duration: 6,
                            delay: delay,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    >
                        <Icon className="h-6 w-6 text-teal-500/30 dark:text-teal-400/20" strokeWidth={1.5} />
                    </motion.div>
                ))}
            </div>

            {/* Left Side - Elegant Typography */}
            <div className="relative z-10 w-full lg:w-1/2 min-h-[35vh] sm:min-h-[40vh] lg:h-screen flex items-center justify-center lg:justify-end lg:pr-24 pt-12 sm:pt-0">
                <div className="px-6 sm:px-8 max-w-xl text-center lg:text-left">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-4 sm:px-5 py-2 text-[10px] sm:text-xs font-medium tracking-[0.15em] text-slate-600 dark:text-slate-300 mb-6 sm:mb-8 backdrop-blur-sm shadow-sm uppercase cursor-default transition-all duration-300"
                        >
                            <Sparkles className="mr-2 h-3 w-3 text-teal-500" />
                            Clinical Intelligence
                        </motion.div>

                        <h1
                            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-4 sm:mb-6 text-slate-900 dark:text-white leading-[1.1]"
                            style={{ fontFamily: "'Playfair Display', ui-serif, Georgia, serif" }}
                        >
                            The Future of{" "}
                            <span
                                className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500 dark:from-teal-400 dark:via-teal-300 dark:to-emerald-400 animate-gradient-x bg-[length:200%_100%]"
                                style={{ fontFamily: "'Playfair Display', ui-serif, Georgia, serif" }}
                            >
                                Clinical Education.
                            </span>
                        </h1>

                        {/* Typewriter effect tagline */}
                        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-light max-w-sm sm:max-w-md mx-auto lg:mx-0 h-[3em] sm:h-[2.5em]">
                            {displayText}
                            {!isComplete && (
                                <motion.span
                                    animate={{ opacity: [1, 0] }}
                                    transition={{ duration: 0.5, repeat: Infinity }}
                                    className="inline-block w-0.5 h-5 bg-teal-500 ml-0.5 align-middle"
                                />
                            )}
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* Right Side - Card with Micro-interactions */}
            <div className="relative z-10 w-full lg:w-1/2 flex-1 lg:h-screen flex items-start sm:items-center justify-center lg:justify-start lg:pl-24 p-4 sm:p-6 pb-8 sm:pb-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full max-w-[400px] sm:max-w-[420px]"
                    style={{ perspective: 1000 }}
                >
                    <motion.div
                        className="relative group"
                        whileHover={{ y: isMobile ? 0 : -4 }}
                        style={{
                            rotateX: cardRotateX,
                            rotateY: cardRotateY,
                            transformStyle: "preserve-3d"
                        }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                        {/* Subtle ambient glow */}
                        <div className="absolute -inset-4 sm:-inset-6 bg-gradient-to-tr from-teal-100/50 to-slate-100/50 dark:from-teal-900/30 dark:to-slate-900/30 rounded-[2.5rem] blur-2xl opacity-50 group-hover:opacity-70 transition-all duration-500" />

                        {/* Clean Card */}
                        <div className="relative rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 p-6 sm:p-8 md:p-10 overflow-hidden transition-all duration-300 group-hover:shadow-2xl group-hover:border-slate-300 dark:group-hover:border-slate-600">

                            <div className="relative z-10 mb-6 sm:mb-8 text-center">
                                <motion.div
                                    className="mx-auto flex items-center justify-center mb-4 sm:mb-6"
                                    whileHover={{ scale: 1.05, rotate: 2 }}
                                    whileTap={{ scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    {/* Logo */}
                                    <span
                                        className="text-2xl sm:text-3xl tracking-tight text-slate-900 dark:text-white"
                                        style={{ fontFamily: "'Playfair Display', ui-serif, Georgia, serif" }}
                                    >
                                        <span className="font-light">Med</span><span className="font-bold text-teal-600 dark:text-teal-400">Stint</span>
                                    </span>
                                </motion.div>
                                <h2
                                    className="text-xl sm:text-2xl font-light tracking-tight text-slate-900 dark:text-white"
                                    style={{ fontFamily: "'Playfair Display', ui-serif, Georgia, serif" }}
                                >
                                    Welcome back
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm font-light">
                                    Sign in to access your workspace.
                                </p>
                            </div>

                            <div className="relative z-10 space-y-3 sm:space-y-4">
                                {/* Primary Button with micro-interactions */}
                                <motion.div
                                    whileHover={{ scale: isMobile ? 1 : 1.02, y: isMobile ? 0 : -2 }}
                                    whileTap={{ scale: 0.97 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <Button
                                        asChild
                                        size="lg"
                                        className="w-full h-11 sm:h-12 text-sm font-medium rounded-xl shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 transition-all duration-300 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white border-none group/btn overflow-hidden relative"
                                    >
                                        <Link href="/auth/sign-in">
                                            {/* Shimmer effect on hover */}
                                            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
                                            <span className="relative flex items-center justify-center gap-2">
                                                Sign In
                                                <ArrowRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform duration-200" />
                                            </span>
                                        </Link>
                                    </Button>
                                </motion.div>

                                <div className="relative py-2">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                                    </div>
                                    <div className="relative flex justify-center text-[10px] uppercase tracking-[0.15em] font-medium">
                                        <span className="bg-white dark:bg-slate-900 px-3 text-slate-400">
                                            Or
                                        </span>
                                    </div>
                                </div>

                                {/* Secondary Button with micro-interactions */}
                                <motion.div
                                    whileHover={{ scale: isMobile ? 1 : 1.02, y: isMobile ? 0 : -2 }}
                                    whileTap={{ scale: 0.97 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    <Button
                                        asChild
                                        variant="outline"
                                        size="lg"
                                        className="w-full h-11 sm:h-12 text-sm font-medium rounded-xl border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all group/btn2"
                                    >
                                        <Link href="/auth/sign-up">
                                            <span className="group-hover/btn2:tracking-wider transition-all duration-300">
                                                Create an Account
                                            </span>
                                        </Link>
                                    </Button>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        className="mt-6 sm:mt-8 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500 tracking-wider uppercase"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8, duration: 0.6 }}
                    >
                        <p>Enterprise-grade security</p>
                    </motion.div>
                </motion.div>
            </div>
        </div>
    )
}
