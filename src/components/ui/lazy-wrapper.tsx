import type React from "react"
import { type ComponentType, lazy, Suspense } from "react"
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

interface LazyWrapperProps {
  fallback?: React.ReactNode
  className?: string
}

// Generic lazy wrapper component
export function LazyWrapper(
  importFunc: () => Promise<{ default: ComponentType<any> }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(importFunc)

  return function WrappedComponent(props: any) {
    const { fallback: propsFallback, className, ...componentProps } = props

    return (
      <Suspense
        fallback={
          propsFallback || fallback || <Skeleton className={cn("h-32 w-full", className)} />
        }
      >
        <LazyComponent {...componentProps} />
      </Suspense>
    )
  }
}

// Specific lazy wrappers for common dashboard widgets
export const LazyClockWidget = LazyWrapper(
  () => import("../student/clock-widget"),
  <div className="w-full">
    <Skeleton className="h-80 w-full rounded-lg" />
  </div>
)

// Higher-order component for lazy loading with intersection observer
export function withLazyLoading<T extends Record<string, any>>(
  Component: ComponentType<T>,
  fallback?: React.ReactNode
) {
  return function LazyLoadedComponent(props: T & { className?: string }) {
    return (
      <Suspense
        fallback={
          fallback || (
            <div className={props.className}>
              <Skeleton className="h-64 w-full rounded-lg" />
            </div>
          )
        }
      >
        <Component {...props} />
      </Suspense>
    )
  }
}
