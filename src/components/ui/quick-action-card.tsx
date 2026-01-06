import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import Link from "next/link"

interface QuickActionCardProps {
  title: string
  description: string
  icon: LucideIcon | React.ReactNode
  href: string
  buttonText?: string
  color?: string
  badge?: number
  className?: string
}

export function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  buttonText = "Go",
  color,
  badge,
  className,
}: QuickActionCardProps) {
  const IconElement = typeof Icon === "function" ? <Icon className="h-5 w-5" /> : Icon

  return (
    <Card
      className={cn(
        "bg-white/5 backdrop-blur-md border-white/10 hover:bg-white/10 transition-colors rounded-xl border",
        className
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-lg", color || "bg-muted")}>
            <div className="text-white">{IconElement}</div>
          </div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        {badge !== undefined && badge > 0 && <Badge variant="secondary">{badge}</Badge>}
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">{description}</p>
        <Button
          asChild
          size="sm"
          className="w-full bg-white/5 hover:bg-white/10 border-white/10 border backdrop-blur-sm transition-all"
        >
          <Link href={href}>{buttonText}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
