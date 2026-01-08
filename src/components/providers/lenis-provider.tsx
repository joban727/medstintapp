"use client"

import Lenis from "lenis"
import { createContext, useContext, useEffect, useRef, useState } from "react"

// Lenis context type
interface LenisContextType {
    lenis: Lenis | null
    scrollTo: (target: string | HTMLElement | number, options?: { offset?: number; duration?: number }) => void
}

const LenisContext = createContext<LenisContextType>({
    lenis: null,
    scrollTo: () => { },
})

/**
 * useLenis - Hook to access Lenis instance and scrollTo function
 */
export function useLenis() {
    return useContext(LenisContext)
}

/**
 * LenisProvider - Premium smooth scroll for marketing pages
 * Uses Lenis for butter-smooth scrolling with momentum
 */
export function LenisProvider({ children }: { children: React.ReactNode }) {
    const [lenis, setLenis] = useState<Lenis | null>(null)
    const rafRef = useRef<number | null>(null)

    useEffect(() => {
        // Initialize Lenis with optimized settings
        const lenisInstance = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Smooth exponential easing
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
            infinite: false,
        })

        setLenis(lenisInstance)

        // Animation loop
        function raf(time: number) {
            lenisInstance.raf(time)
            rafRef.current = requestAnimationFrame(raf)
        }
        rafRef.current = requestAnimationFrame(raf)

        // Cleanup on unmount
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
            }
            lenisInstance.destroy()
        }
    }, [])

    // ScrollTo function that uses Lenis
    const scrollTo = (
        target: string | HTMLElement | number,
        options?: { offset?: number; duration?: number }
    ) => {
        if (!lenis) return
        lenis.scrollTo(target, {
            offset: options?.offset ?? 0,
            duration: options?.duration ?? 1.2,
        })
    }

    return (
        <LenisContext.Provider value={{ lenis, scrollTo }}>
            {children}
        </LenisContext.Provider>
    )
}
