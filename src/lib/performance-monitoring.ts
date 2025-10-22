import { useEffect, useRef } from 'react'

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
    
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName} mounted in ${mountTime.current.toFixed(2)}ms`)
    }

    return () => {
      // Component unmounted
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${componentName} unmounted after ${performance.now() - startTime.current}ms`)
      }
    }
  }, [componentName])

  useEffect(() => {
    // Track render time
    renderTime.current = performance.now()
    
    // Use requestAnimationFrame to measure actual render time
    requestAnimationFrame(() => {
      const actualRenderTime = performance.now() - renderTime.current
      if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log(`[Performance] ${componentName} rendered in ${actualRenderTime.toFixed(2)}ms`)
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
      hydrationTime: typeof window !== 'undefined' ? mountTime.current : undefined
    })
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
    
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName} function executed in ${(end - start).toFixed(2)}ms`)
    }
    
    return result
  }) as T
}