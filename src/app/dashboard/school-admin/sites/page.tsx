import { count, eq } from "drizzle-orm"
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
import { db } from "../../../../database/db"
import { clinicalSites, rotations } from "../../../../database/schema"
import { requireAnyRole } from "../../../../lib/auth-clerk"

export default async function ClinicalSitesPage() {
  const _user = await requireAnyRole(["SCHOOL_ADMIN"], "/dashboard")

  // Fetch clinical sites for this school
  const sites = await db
    .select({
      id: clinicalSites.id,
      name: clinicalSites.name,
      address: clinicalSites.address,
      contactPerson: clinicalSites.contactPersonName,
      contactEmail: clinicalSites.contactPersonEmail,
      contactPhone: clinicalSites.contactPersonPhone,
      isActive: clinicalSites.isActive,
      createdAt: clinicalSites.createdAt,
      updatedAt: clinicalSites.updatedAt,
      activeRotations: count(rotations.id),
    })
    .from(clinicalSites)
    .leftJoin(rotations, eq(rotations.clinicalSiteId, clinicalSites.id))
    .groupBy(clinicalSites.id)

  const siteStats = {
    totalSites: sites.length,
    activeSites: sites.filter((s) => s.isActive).length,
    totalRotations: sites.reduce((sum, s) => sum + s.activeRotations, 0),
    partneredSites: sites.filter((s) => s.contactPerson).length,
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl text-gray-900">Clinical Sites</h1>
          <p className="mt-1 text-gray-600">Manage clinical rotation sites and partnerships</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Clinical Site
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Total Sites</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{siteStats.totalSites}</div>
            <p className="text-muted-foreground text-xs">All clinical sites</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Sites</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{siteStats.activeSites}</div>
            <p className="text-muted-foreground text-xs">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Active Rotations</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{siteStats.totalRotations}</div>
            <p className="text-muted-foreground text-xs">Ongoing rotations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="font-medium text-sm">Partnership Sites</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{siteStats.partneredSites}</div>
            <p className="text-muted-foreground text-xs">With contacts</p>
          </CardContent>
        </Card>
      </div>

      {/* Sites Management */}
      <Card>
        <CardHeader>
          <CardTitle>Clinical Sites Directory</CardTitle>
          <CardDescription>Manage your clinical rotation sites and partnerships</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter */}
          <div className="mb-6 flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-gray-400" />
              <Input placeholder="Search clinical sites..." className="pl-10" />
            </div>
            <Select>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="CA">California</SelectItem>
                <SelectItem value="NY">New York</SelectItem>
                <SelectItem value="TX">Texas</SelectItem>
                <SelectItem value="FL">Florida</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              More Filters
            </Button>
          </div>

          {/* Sites Table */}
          <Table>
            <TableHeader>
              <TableRow>
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
                <TableRow key={site.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{site.name}</div>
                      <div className="text-gray-500 text-sm">Clinical Site</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-start">
                      <MapPin className="mt-0.5 mr-1 h-4 w-4 text-gray-400" />
                      <div className="text-sm">
                        <div className="text-gray-500">{site.address}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{site.contactPerson || "Not assigned"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {site.contactEmail && (
                        <div className="flex items-center text-sm">
                          <Mail className="mr-1 h-3 w-3" />
                          {site.contactEmail}
                        </div>
                      )}
                      {site.contactPhone && (
                        <div className="flex items-center text-sm">
                          <Phone className="mr-1 h-3 w-3" />
                          {site.contactPhone}
                        </div>
                      )}
                      {!site.contactEmail && !site.contactPhone && (
                        <span className="text-gray-500 text-sm">No contact info</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      <Calendar className="mr-1 h-4 w-4 text-gray-400" />
                      <span>{site.activeRotations} rotations</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={site.isActive ? "default" : "secondary"}>
                      {site.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Edit Site</DropdownMenuItem>
                        <DropdownMenuItem>Manage Rotations</DropdownMenuItem>
                        <DropdownMenuItem>View Students</DropdownMenuItem>
                        <DropdownMenuItem>Contact Info</DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          {site.isActive ? "Deactivate" : "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {sites.length === 0 && (
            <div className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 font-medium text-gray-900 text-sm">No clinical sites found</h3>
              <p className="mt-1 text-gray-500 text-sm">
                Get started by adding your first clinical site.
              </p>
              <div className="mt-6">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Clinical Site
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
