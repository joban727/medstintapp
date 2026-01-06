import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface LoadingSkeletonProps {
  count?: number
  height?: string
  className?: string
}

export function LoadingSkeleton({ count = 1, height = "h-4", className }: LoadingSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn(height, "w-full", className)} />
      ))}
    </div>
  )
}
