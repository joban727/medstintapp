"use client"

import { useAuth } from "@clerk/nextjs"
import {
  Building2,
  Edit,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Hospital,
  Stethoscope,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ManagedFacility {
  id: string
  facilityName: string
  facilityType: string
  address: string
  latitude: string
  longitude: string
  osmId?: string
  priority: number
  isCustom: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  clinicalSiteId?: string
}

interface FacilityFormData {
  facilityName: string
  facilityType: string
  address: string
  latitude: string
  longitude: string
  osmId?: string
  priority: number
  isCustom: boolean
  clinicalSiteId?: string
}

const FACILITY_TYPES = [
  { value: "hospital", label: "Hospital", icon: Hospital },
  { value: "clinic", label: "Clinic", icon: Stethoscope },
  { value: "emergency", label: "Emergency Department", icon: AlertCircle },
  { value: "urgent_care", label: "Urgent Care", icon: Clock },
  { value: "pharmacy", label: "Pharmacy", icon: Building2 },
  { value: "laboratory", label: "Laboratory", icon: CheckCircle },
]

export default function FacilityManagementPage() {
  const { userId } = useAuth()
  const [facilities, setFacilities] = useState<ManagedFacility[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingFacility, setEditingFacility] = useState<ManagedFacility | null>(null)
  const [formData, setFormData] = useState<FacilityFormData>({
    facilityName: "",
    facilityType: "hospital",
    address: "",
    latitude: "",
    longitude: "",
    osmId: "",
    priority: 1,
    isCustom: true,
    clinicalSiteId: undefined,
  })
  const [clinicalSitesOptions, setClinicalSitesOptions] = useState<{ id: string; name: string }[]>(
    []
  )
  const [sitesLoading, setSitesLoading] = useState(false)

  const fetchFacilities = useCallback(async () => {
    try {
      const response = await fetch("/api/facility-management")
      if (response.ok) {
        const data = await response.json()
        setFacilities(data?.data?.facilities ?? data?.facilities ?? [])
      } else {
        toast.error("Failed to load facilities")
      }
    } catch (error) {
      console.error("Error fetching facilities:", error)
      toast.error("Error loading facilities")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchClinicalSites = useCallback(async () => {
    try {
      setSitesLoading(true)
      const resp = await fetch("/api/competencies?isActive=true&limit=200")
      if (resp.ok) {
        const payload = await resp.json()
        const rawSites = payload?.data ?? payload?.sites ?? []
        const options = rawSites.map((s: any) => ({ id: s.id, name: s.name }))
        setClinicalSitesOptions(options)
      } else {
        toast.error("Failed to load clinical sites")
      }
    } catch (err) {
      console.error("Error fetching clinical sites:", err)
      toast.error("Error loading clinical sites")
    } finally {
      setSitesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isDialogOpen) {
      fetchClinicalSites()
    }
  }, [isDialogOpen, fetchClinicalSites])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const method = editingFacility ? "PUT" : "POST"
      const url = editingFacility
        ? `/api/facility-management?id=${editingFacility.id}`
        : "/api/facility-management"

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success(
          editingFacility ? "Facility updated successfully" : "Facility created successfully"
        )
        setIsDialogOpen(false)
        setEditingFacility(null)
        resetForm()
        fetchFacilities()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to save facility")
      }
    } catch (error) {
      console.error("Error saving facility:", error)
      toast.error("Error saving facility")
    }
  }

  const handleEdit = (facility: ManagedFacility) => {
    setEditingFacility(facility)
    setFormData({
      facilityName: facility.facilityName,
      facilityType: facility.facilityType,
      address: facility.address,
      latitude: facility.latitude,
      longitude: facility.longitude,
      osmId: facility.osmId || "",
      priority: facility.priority,
      isCustom: facility.isCustom,
      clinicalSiteId: facility.clinicalSiteId,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (facilityId: string) => {
    if (!confirm("Are you sure you want to delete this facility?")) {
      return
    }

    try {
      const response = await fetch(`/api/facility-management?id=${facilityId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Facility deleted successfully")
        fetchFacilities()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to delete facility")
      }
    } catch (error) {
      console.error("Error deleting facility:", error)
      toast.error("Error deleting facility")
    }
  }

  const resetForm = () => {
    setFormData({
      facilityName: "",
      facilityType: "hospital",
      address: "",
      latitude: "",
      longitude: "",
      osmId: "",
      priority: 1,
      isCustom: true,
      clinicalSiteId: undefined,
    })
  }

  const filteredFacilities = facilities.filter(
    (facility) =>
      facility.facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      facility.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      facility.facilityType.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getFacilityTypeIcon = (type: string) => {
    const facilityType = FACILITY_TYPES.find((ft) => ft.value === type)
    return facilityType?.icon || Building2
  }

  const getFacilityTypeLabel = (type: string) => {
    const facilityType = FACILITY_TYPES.find((ft) => ft.value === type)
    return facilityType?.label || type
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facility Management</h1>
          <p className="text-muted-foreground">
            Manage medical facilities and their location data for enhanced clock-in accuracy
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm()
                setEditingFacility(null)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Facility
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingFacility ? "Edit Facility" : "Add New Facility"}</DialogTitle>
              <DialogDescription>
                {editingFacility
                  ? "Update the facility information below."
                  : "Add a new medical facility to the system for enhanced location tracking."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="facilityName">Facility Name</Label>
                  <Input
                    id="facilityName"
                    value={formData.facilityName}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, facilityName: e.target.value }))
                    }
                    placeholder="St. Mary's Hospital"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facilityType">Facility Type</Label>
                  <Select
                    value={formData.facilityType}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, facilityType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FACILITY_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center">
                            <type.icon className="mr-2 h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="123 Medical Center Dr, City, State 12345"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    type="number"
                    step="any"
                    value={formData.latitude}
                    onChange={(e) => setFormData((prev) => ({ ...prev, latitude: e.target.value }))}
                    placeholder="40.7128"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    type="number"
                    step="any"
                    value={formData.longitude}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, longitude: e.target.value }))
                    }
                    placeholder="-74.0060"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="linkedClinicalSite">Linked Clinical Site (optional)</Label>
                  <Select
                    value={formData.clinicalSiteId ?? "none"}
                    onValueChange={(val) =>
                      setFormData((prev) => ({
                        ...prev,
                        clinicalSiteId: val === "none" ? undefined : val,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={sitesLoading ? "Loading sites..." : "Select a clinical site"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={"none"}>None</SelectItem>
                      {clinicalSitesOptions.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="osmId">OpenStreetMap ID (Optional)</Label>
                  <Input
                    id="osmId"
                    value={formData.osmId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, osmId: e.target.value }))}
                    placeholder="way/123456789"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority (1-10)</Label>
                <Input
                  id="priority"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      priority: Number.parseInt(e.target.value) || 1,
                    }))
                  }
                  required
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingFacility ? "Update Facility" : "Add Facility"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Managed Facilities</CardTitle>
          <CardDescription>
            Medical facilities configured for enhanced location tracking
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search facilities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFacilities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {searchTerm
                        ? "No facilities match your search."
                        : "No facilities configured yet."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFacilities.map((facility) => {
                    const IconComponent = getFacilityTypeIcon(facility.facilityType)
                    return (
                      <TableRow key={facility.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <IconComponent className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{facility.facilityName}</div>
                              {facility.isCustom && (
                                <Badge variant="secondary" className="text-xs">
                                  Custom
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getFacilityTypeLabel(facility.facilityType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{facility.address}</TableCell>
                        <TableCell className="font-mono text-sm">
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span>
                              {Number.parseFloat(facility.latitude).toFixed(4)},{" "}
                              {Number.parseFloat(facility.longitude).toFixed(4)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              facility.priority <= 3
                                ? "default"
                                : facility.priority <= 7
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {facility.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={facility.isActive ? "default" : "secondary"}>
                            {facility.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(facility)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(facility.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
