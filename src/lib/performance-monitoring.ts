import { useEffect, useRef } from "react"
import { logger } from "@/lib/logger"

interface PerformanceMetrics {
  componentName: string
  mountTime: number
  renderTime: number
  hydrationTime?: number
}

export function usePerformanceMonitoring(componentName: string) {
  const startTime = useRef<number>(0)
  const mountTime = useRef<number>(0)
  const renderTime = useRef<number>(0)

  useEffect(() => {
    // Component mounted
    mountTime.current = performance.now() - startTime.current

    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      logger.debug({ duration: mountTime.current }, `[Performance] ${componentName} mounted`)
    }

    return () => {
      // Component unmounted
      if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
        logger.debug(
          { duration: performance.now() - startTime.current },
          `[Performance] ${componentName} unmounted`
        )
      }
    }
  }, [componentName])

  useEffect(() => {
    // Track render time
    renderTime.current = performance.now()

    // Use requestAnimationFrame to measure actual render time
    requestAnimationFrame(() => {
      const actualRenderTime = performance.now() - renderTime.current
      if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
        logger.debug({ duration: actualRenderTime }, `[Performance] ${componentName} rendered`)
      }
    })
  })

  // Initialize start time
  if (startTime.current === 0) {
    startTime.current = performance.now()
  }

  return {
    getMetrics: (): PerformanceMetrics => ({
      componentName,
      mountTime: mountTime.current,
      renderTime: renderTime.current,
      hydrationTime: typeof window !== "undefined" ? mountTime.current : undefined,
    }),
  }
}

export function measureComponentPerformance<T extends (...args: any[]) => any>(
  fn: T,
  componentName: string
): T {
  return ((...args: Parameters<T>) => {
    const start = performance.now()
    const result = fn(...args)
    const end = performance.now()

    if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
      logger.debug({ duration: end - start }, `[Performance] ${componentName} function executed`)
    }

    return result
  }) as T
}
