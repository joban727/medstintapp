import React from "react"
import { Skeleton } from "./skeleton"
import { cn } from "@/lib/utils"

interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    count?: number
    height?: string
}

export function LoadingSkeleton({
    count = 1,
    height = "h-4",
    className,
    ...props
}: LoadingSkeletonProps) {
    return (
        <>
            {Array.from({ length: count }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn(height, className)}
                    {...props}
                />
            ))}
        </>
    )
}
