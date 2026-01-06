import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { QuickActionCard } from "@/components/ui/quick-action-card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export interface QuickAction {
  title: string
  description: string
  icon: LucideIcon | React.ReactNode
  href: string
  color?: string
  badge?: {
    count: number
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info"
  }
}

interface QuickActionsFromArrayProps {
  title?: string
  badge?: string
  actions: QuickAction[]
  className?: string
  columns?: 2 | 3 | 4
}

export function QuickActionsFromArray({
  title,
  badge,
  actions,
  className,
  columns = 4,
}: QuickActionsFromArrayProps) {
  const gridCols = {
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
  }

  return (
    <div className={cn("space-y-4", className)}>
      {(title || badge) && (
        <div className="flex items-center justify-between">
          {title && <h2 className="text-xl font-semibold tracking-tight">{title}</h2>}
          {badge && <Badge variant="outline">{badge}</Badge>}
        </div>
      )}
      <div className={cn("grid gap-4", gridCols[columns])}>
        {actions.map((action) => (
          <QuickActionCard
            key={action.title}
            title={action.title}
            description={action.description}
            icon={action.icon}
            href={action.href}
            color={action.color}
            badge={action.badge?.count}
          />
        ))}
      </div>
    </div>
  )
}
