import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ClockWidgetSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current time skeleton */}
        <div className="space-y-2 text-center">
          <Skeleton className="mx-auto h-8 w-24" />
          <Skeleton className="mx-auto h-4 w-16" />
        </div>

        {/* Elapsed time skeleton */}
        <div className="text-center">
          <Skeleton className="mx-auto h-5 w-28" />
        </div>

        {/* Current site skeleton */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </div>

        {/* Action buttons skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-12 flex-1 rounded-md" />
          <Skeleton className="h-12 w-12 rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}

export function ClockWidgetSkeletonCompact() {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current time skeleton */}
        <div className="text-center">
          <Skeleton className="mx-auto h-6 w-20" />
        </div>

        {/* Action button skeleton */}
        <Skeleton className="h-10 w-full rounded-md" />
      </CardContent>
    </Card>
  )
}
