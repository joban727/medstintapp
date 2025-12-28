import { and, count, eq, inArray } from "drizzle-orm"
import {
  Building2,
  Calendar,
  Filter,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Users,
} from "lucide-react"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu"
import { Input } from "../../../../components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table"
import { db } from "@/database/connection-pool"
import { facilityManagement, rotations } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"
import { getSchoolContext } from "../../../../lib/school-utils"
import ClinicalSitesActionBar from "./ClinicalSitesActionBar"
import { ClinicalSiteRowActions } from "./ClinicalSiteRowActions"
import { PageContainer, PageHeader } from "@/components/ui/page-container"
import { StatCard, StatGrid } from "@/components/ui/stat-card"
import { cn } from "@/lib/utils"
import { DashboardCard } from "@/components/dashboard/shared/dashboard-card"

export default async function ClinicalSitesPage() {
  const _user = await requireAnyRole(["SCHOOL_ADMIN"], "/dashboard")
  const context = await getSchoolContext()

  // Ensure user is associated with a school
  // If no school ID (e.g. skipped onboarding), return empty list instead of throwing error
  let facilities: any[] = []

  if (context.schoolId) {
    // Fetch all facilities for this school (not just those created by current user)
    facilities = await db
      .select({
        id: facilityManagement.id,
        facilityName: facilityManagement.facilityName,
        address: facilityManagement.address,
        contactInfo: facilityManagement.contactInfo,
        isActive: facilityManagement.isActive,
        createdAt: facilityManagement.createdAt,
        updatedAt: facilityManagement.updatedAt,
        clinicalSiteId: facilityManagement.clinicalSiteId,
        geofenceRadius: facilityManagement.geofenceRadius,
        strictGeofence: facilityManagement.strictGeofence,
        priority: facilityManagement.priority,
        notes: facilityManagement.notes,
        facilityType: facilityManagement.facilityType,
      })
      .from(facilityManagement)
      .where(eq(facilityManagement.schoolId, context.schoolId))
  } else {
    console.log("No school ID found for user, returning empty facilities list")
  }

  // Diagnostics: summarize facility and rotation linkage for visibility comparisons
  console.info(
    "[LOG-3 AdminSitesPage] schoolId=%s facilities=%d",
    context.schoolId,
    facilities.length
  )

  // Compute active rotation counts per linked clinical site in a separate query
  const clinicalSiteIds = Array.from(
    new Set(facilities.map((f) => f.clinicalSiteId).filter((id): id is string => Boolean(id)))
  )

  let activeCountsBySiteId: Record<string, number> = {}
  if (clinicalSiteIds.length > 0) {
    const counts = await db
      .select({
        clinicalSiteId: rotations.clinicalSiteId,
        activeRotations: count(rotations.id),
      })
      .from(rotations)
      .where(
        and(inArray(rotations.clinicalSiteId, clinicalSiteIds), eq(rotations.status, "ACTIVE"))
      )
      .groupBy(rotations.clinicalSiteId)

    activeCountsBySiteId = Object.fromEntries(
      counts.map((c) => [c.clinicalSiteId, Number(c.activeRotations)])
    )
    console.info(
      "[LOG-3 AdminSitesPage] linkedClinicalSites=%d activeRotationSites=%d",
      clinicalSiteIds.length,
      counts.length
    )
  }

  const sites = facilities.map((f) => {
    const contactInfo = (f as any).contactInfo || {}
    return {
      id: f.id,
      name: (f as any).facilityName,
      address: f.address,
      contactPerson: contactInfo.contactName || contactInfo.name || null,
      contactEmail: contactInfo.email || null,
      contactPhone: contactInfo.phone || null,
      isActive: f.isActive,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      activeRotations: activeCountsBySiteId[f.clinicalSiteId || ""] ?? 0,
      geofenceRadius: f.geofenceRadius,
      strictGeofence: f.strictGeofence,
      priority: f.priority,
      notes: f.notes,
      facilityType: f.facilityType,
    }
  })

  const siteStats = {
    totalSites: sites.length,
    activeSites: sites.filter((s) => s.isActive).length,
    totalRotations: sites.reduce((sum, s) => sum + s.activeRotations, 0),
    partneredSites: sites.filter((s) => s.contactPerson || s.contactEmail || s.contactPhone).length,
  }

  return (
    <PageContainer>
      <PageHeader
        title="Clinical Sites"
        description="Manage clinical rotation sites and partnerships"
      />

      {/* Stats Cards - Inline since Server Component cannot pass icon functions to Client Components */}
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 stagger-children">
        <DashboardCard
          title="Total Sites"
          icon={
            <div className="icon-container icon-container-blue">
              <Building2 className="h-4 w-4" />
            </div>
          }
          variant="glass"
          className="card-hover-lift spotlight-card border-l-4 border-l-blue-500"
        >
          <div className="font-bold text-2xl animate-stat-value">{siteStats.totalSites}</div>
          <p className="text-muted-foreground text-xs">School-managed facilities</p>
        </DashboardCard>
        <DashboardCard
          title="Active Sites"
          icon={
            <div className="icon-container icon-container-green">
              <MapPin className="h-4 w-4" />
            </div>
          }
          variant="glass"
          className="card-hover-lift spotlight-card border-l-4 border-l-green-500"
        >
          <div className="font-bold text-2xl animate-stat-value">{siteStats.activeSites}</div>
          <p className="text-muted-foreground text-xs">Currently active</p>
        </DashboardCard>
        <DashboardCard
          title="Active Rotations"
          icon={
            <div className="icon-container icon-container-purple">
              <Calendar className="h-4 w-4" />
            </div>
          }
          variant="glass"
          className="card-hover-lift spotlight-card border-l-4 border-l-purple-500"
        >
          <div className="font-bold text-2xl animate-stat-value">{siteStats.totalRotations}</div>
          <p className="text-muted-foreground text-xs">Ongoing rotations</p>
        </DashboardCard>
        <DashboardCard
          title="Partnership Sites"
          icon={
            <div className="icon-container icon-container-orange">
              <Users className="h-4 w-4" />
            </div>
          }
          variant="glass"
          className="card-hover-lift spotlight-card border-l-4 border-l-orange-500"
        >
          <div className="font-bold text-2xl animate-stat-value">{siteStats.partneredSites}</div>
          <p className="text-muted-foreground text-xs">With contacts</p>
        </DashboardCard>
      </div>

      {/* Consolidated Action Bar */}
      <ClinicalSitesActionBar
        totalSites={siteStats.totalSites}
        activeSites={siteStats.activeSites}
      />

      {/* Sites Management */}
      <Card className="glass-card overflow-hidden">
        <CardHeader>
          <CardTitle>Clinical Sites Directory</CardTitle>
          <CardDescription>Manage your clinical rotation sites and partnerships</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3 p-4">
            {sites.map((site) => (
              <div
                key={site.id}
                className="rounded-lg border bg-card/50 backdrop-blur-sm p-4 card-hover-lift"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{site.name}</div>
                    <div className="text-muted-foreground text-sm">Clinical Site</div>
                  </div>
                  <ClinicalSiteRowActions site={site} />
                </div>

                <div className="mt-3 flex items-start text-sm">
                  <MapPin className="mt-0.5 mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="text-muted-foreground">{site.address}</div>
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center">
                    <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{site.contactPerson || "Not assigned"}</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{site.contactEmail || "No email"}</span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{site.contactPhone || "No phone"}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary" className="bg-secondary/50">
                    Rotations: {site.activeRotations}
                  </Badge>
                  <Badge
                    className={cn(
                      site.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    )}
                  >
                    {site.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Sites Table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/50">
                  <TableHead>Site Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead>Active Rotations</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sites.map((site) => (
                  <TableRow
                    key={site.id}
                    className="group hover:bg-muted/30 transition-colors duration-200 border-b border-border/50"
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium group-hover:text-primary transition-colors">
                          {site.name}
                        </div>
                        <div className="text-muted-foreground text-sm">Clinical Site</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start">
                        <MapPin className="mt-0.5 mr-1 h-4 w-4 text-muted-foreground" />
                        <div className="text-sm">
                          <div className="text-muted-foreground">{site.address}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{site.contactPerson || "Not assigned"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center">
                          <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>{site.contactEmail || "No email"}</span>
                        </div>
                        <div className="flex items-center">
                          <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span>{site.contactPhone || "No phone"}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-secondary/50">
                        {site.activeRotations}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "transition-all duration-300",
                          site.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"
                        )}
                      >
                        {site.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ClinicalSiteRowActions site={site} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  )
}
