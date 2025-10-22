import { count, eq } from "drizzle-orm"
import {
  Building,
  Calendar,
  Edit,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
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
import { db } from "../../../../database/db"
import { clinicalSites, rotations } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function ClinicalSitesPage() {
  const _user = await requireAnyRole(["SUPER_ADMIN"], "/dashboard")

  // Fetch all clinical sites with rotation counts
  const allSites = await db
    .select({
      id: clinicalSites.id,
      name: clinicalSites.name,
      address: clinicalSites.address,
      contactPerson: clinicalSites.contactPersonName,
      contactEmail: clinicalSites.contactPersonEmail,
      contactPhone: clinicalSites.contactPersonPhone,
      type: clinicalSites.type,
      capacity: clinicalSites.capacity,
      createdAt: clinicalSites.createdAt,
      rotationCount: count(rotations.id),
    })
    .from(clinicalSites)
    .leftJoin(rotations, eq(clinicalSites.id, rotations.clinicalSiteId))
    .groupBy(clinicalSites.id)
    .orderBy(clinicalSites.createdAt)

  const siteTypeColors = {
    HOSPITAL: "bg-red-100 text-red-800",
    CLINIC: "bg-blue-100 text-blue-800",
    COMMUNITY_HEALTH: "bg-green-100 text-green-800",
    SPECIALTY_PRACTICE: "bg-purple-100 text-purple-800",
    OTHER: "bg-gray-100 text-gray-800",
  }

  const totalSites = allSites.length
  const totalCapacity = allSites.reduce((sum, site) => sum + (site.capacity || 0), 0)
  const activeRotations = allSites.reduce((sum, site) => sum + site.rotationCount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Clinical Sites</h1>
          <p className="text-muted-foreground">Manage clinical rotation sites and partnerships</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Site
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Sites</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalSites}</div>
            <p className="text-muted-foreground text-xs">Active partnerships</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Capacity</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{totalCapacity}</div>
            <p className="text-muted-foreground text-xs">Student positions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Rotations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{activeRotations}</div>
            <p className="text-muted-foreground text-xs">Current placements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Utilization</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {totalCapacity > 0 ? Math.round((activeRotations / totalCapacity) * 100) : 0}%
            </div>
            <p className="text-muted-foreground text-xs">Capacity used</p>
          </CardContent>
        </Card>
      </div>

      {/* Sites Table */}
      <Card>
        <CardHeader>
          <CardTitle>Clinical Sites Directory</CardTitle>
          <CardDescription>Comprehensive list of all clinical rotation sites</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search sites..." className="pl-8" />
            </div>
            <Select>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
                <SelectItem value="community_health">Community Health</SelectItem>
                <SelectItem value="specialty_practice">Specialty Practice</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Active Rotations</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allSites.slice(0, 10).map((site) => (
                <TableRow key={site.id}>
                  <TableCell>
                    <div className="font-medium">{site.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        siteTypeColors[site.type as keyof typeof siteTypeColors] ||
                        siteTypeColors.OTHER
                      }
                    >
                      {site.type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{site.address}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{site.contactPerson}</div>
                      <div className="text-muted-foreground">{site.contactEmail}</div>
                    </div>
                  </TableCell>
                  <TableCell>{site.capacity}</TableCell>
                  <TableCell>{site.rotationCount}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit Site
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Site
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
