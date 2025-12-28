import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface DashboardHeroProps extends React.HTMLAttributes<HTMLDivElement> {
    title: string
    subtitle?: string
    children?: React.ReactNode
    backgroundImage?: string
    actions?: React.ReactNode
}

export function DashboardHero({
    title,
    subtitle,
    children,
    backgroundImage,
    actions,
    className,
    ...props
}: DashboardHeroProps) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-2xl bg-gradient-primary p-6 md:p-10 text-white shadow-lg",
                className
            )}
            {...props}
        >
            {/* Abstract Background Shapes */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute top-1/2 -left-24 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
                <div className="absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-white/5 blur-xl" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="text-lg text-white/90 font-medium">
                            {subtitle}
                        </p>
                    )}
                    {children && (
                        <div className="mt-4 text-white/80">
                            {children}
                        </div>
                    )}
                </div>

                {actions && (
                    <div className="flex flex-wrap gap-3">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    )
}
