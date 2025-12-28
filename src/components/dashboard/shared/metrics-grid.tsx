import { cn } from "@/lib/utils"
import { DashboardCard } from "./dashboard-card"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"

export interface MetricItem {
    label: string
    value: string | number
    change?: number
    changeLabel?: string
    icon?: React.ReactNode
    trend?: "up" | "down" | "neutral"
    color?: "default" | "primary" | "success" | "warning" | "destructive" | "info"
}

interface MetricsGridProps extends React.HTMLAttributes<HTMLDivElement> {
    metrics: MetricItem[]
    columns?: 2 | 3 | 4
}

export function MetricsGrid({ metrics, columns = 4, className, ...props }: MetricsGridProps) {
    const gridCols = {
        2: "grid-cols-1 sm:grid-cols-2",
        3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    }

    return (
        <div className={cn("grid gap-4", gridCols[columns], className)} {...props}>
            {metrics.map((metric, index) => (
                <MetricCard key={index} metric={metric} index={index} />
            ))}
        </div>
    )
}

function MetricCard({ metric, index }: { metric: MetricItem; index: number }) {
    const trendColor = {
        up: "text-success",
        down: "text-destructive",
        neutral: "text-muted-foreground",
    }

    const TrendIcon = {
        up: ArrowUp,
        down: ArrowDown,
        neutral: Minus,
    }

    const Icon = metric.trend ? TrendIcon[metric.trend] : null

    return (
        <DashboardCard
            className="card-hover-lift"
            variant="default"
        >
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-2xl font-bold tracking-tight animate-stat-value" style={{ animationDelay: `${index * 50}ms` }}>
                            {metric.value}
                        </h3>
                        {metric.change !== undefined && (
                            <span className={cn("flex items-center text-xs font-medium", trendColor[metric.trend || "neutral"])}>
                                {Icon && <Icon className="mr-1 h-3 w-3" />}
                                {metric.change}%
                            </span>
                        )}
                    </div>
                    {metric.changeLabel && (
                        <p className="text-xs text-muted-foreground">{metric.changeLabel}</p>
                    )}
                </div>
                {metric.icon && (
                    <div className={cn("p-2 rounded-lg bg-muted/50", metric.color && `text-${metric.color}`)}>
                        {metric.icon}
                    </div>
                )}
            </div>
        </DashboardCard>
    )
}
