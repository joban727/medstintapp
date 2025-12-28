"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Building2, MapPin, Calendar, User } from "lucide-react"
import { cn } from "@/lib/utils"

export type RotationSite = {
  id?: string
  name?: string
  facilityName?: string
  department?: string
  city?: string
  state?: string
  startDate?: string | Date
  endDate?: string | Date
  preceptor?: string
}

interface SwipeableRotationCardProps {
  site: RotationSite
  className?: string
}

export function SwipeableRotationCard({ site, className }: SwipeableRotationCardProps) {
  const start = site.startDate ? new Date(site.startDate).toLocaleDateString() : "TBD"
  const end = site.endDate ? new Date(site.endDate).toLocaleDateString() : "TBD"

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      whileTap={{ cursor: "grabbing" }}
      className={cn("snap-start", className)}
    >
      <Card className="w-[300px] shrink-0 overflow-hidden rounded-xl border bg-card shadow-sm">
        <CardHeader className="gap-2 p-4">
          <CardTitle className="line-clamp-1 text-base font-semibold">
            {site.name || site.department || "Rotation"}
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4" aria-hidden="true" />
            <span className="line-clamp-1">{site.facilityName || "Facility TBD"}</span>
          </div>
        </CardHeader>
        <CardContent className="gap-3 p-4 pt-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" aria-hidden="true" />
            <span className="line-clamp-1">
              {[site.city, site.state].filter(Boolean).join(", ") || "Location TBD"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            <span>
              {start} — {end}
            </span>
          </div>
          {site.preceptor && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" aria-hidden="true" />
              <span className="line-clamp-1">Preceptor: {site.preceptor}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function SwipeableRotationRow({ sites }: { sites: RotationSite[] }) {
  if (!sites || sites.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        No assigned rotations.
      </div>
    )
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex snap-x snap-mandatory gap-3">
        {sites.map((s) => (
          <SwipeableRotationCard key={s.id ?? `${s.name}-${s.startDate}`} site={s} />
        ))}
      </div>
    </div>
  )
}
