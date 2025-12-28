import React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

interface DashboardCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
    title?: React.ReactNode
    description?: React.ReactNode
    footer?: React.ReactNode
    icon?: React.ReactNode
    variant?: "default" | "glass" | "glass-subtle" | "premium" | "flat"
    noPadding?: boolean
}

export const DashboardCard = React.forwardRef<HTMLDivElement, DashboardCardProps>(({
    title,
    description,
    footer,
    icon,
    children,
    className,
    variant = "default",
    noPadding = false,
    ...props
}, ref) => {
    const variantClasses = {
        default: "bg-card text-card-foreground shadow-sm",
        glass: "glass-card backdrop-blur-md",
        "glass-subtle": "glass-card-subtle backdrop-blur-sm",
        premium: "bg-gradient-to-br from-card to-secondary/20 border-primary/10 shadow-md",
        flat: "bg-muted/30 border-transparent shadow-none",
    }

    return (
        <Card
            className={cn(
                "overflow-hidden transition-all duration-200",
                variantClasses[variant],
                className
            )}
            {...props}
        >
            {(title || description || icon) && (
                <CardHeader className={cn("flex flex-row items-start justify-between space-y-0 pb-2", noPadding && "px-0 pt-0")}>
                    <div className="space-y-1">
                        {title && <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>}
                        {description && <CardDescription className="text-sm text-muted-foreground">{description}</CardDescription>}
                    </div>
                    {icon && <div className="text-muted-foreground">{icon}</div>}
                </CardHeader>
            )}
            <CardContent className={cn(noPadding ? "p-0" : "pt-0")}>
                {children}
            </CardContent>
            {footer && <CardFooter className={cn(noPadding && "px-0 pb-0")}>{footer}</CardFooter>}
        </Card>
    )
})
DashboardCard.displayName = "DashboardCard"
