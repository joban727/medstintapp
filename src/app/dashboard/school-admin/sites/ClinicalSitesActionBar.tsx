"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  Settings,
  ChevronDown,
  Loader2,
  Upload,
} from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { debouncedLocationCapture } from "@/lib/location-debouncer"
import { openMapService } from "@/lib/openmap-service"
import { cn } from "@/lib/utils"
import { ClinicalSiteFormDialog } from "./ClinicalSiteFormDialog"

// Facility types aligned with API schema enum
const FACILITY_TYPES = [
  { value: "hospital", label: "Hospital" },
  { value: "clinic", label: "Clinic" },
  { value: "nursing_home", label: "Nursing Home" },
  { value: "outpatient", label: "Outpatient" },
  { value: "emergency", label: "Emergency" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "laboratory", label: "Laboratory" },
  { value: "other", label: "Other" },
]

interface ClinicalSiteOption {
  id: string
  name: string
}

interface FacilityFormData {
  facilityName: string
  facilityType: string
  address: string
  latitude: string
  longitude: string
  geofenceRadius: number
  priority: number
  clinicalSiteId?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  notes?: string
}

interface FilterState {
  search: string
  status: string
  state: string
  facilityType: string
}

interface ClinicalSitesActionBarProps {
  onFiltersChange?: (filters: FilterState) => void
  onRefresh?: () => void
  totalSites?: number
  activeSites?: number
}

export default function ClinicalSitesActionBar({
  onFiltersChange,
  onRefresh,
  totalSites = 0,
  activeSites = 0,
}: ClinicalSitesActionBarProps) {
  const router = useRouter()

  // Add Site Dialog State
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    state: "all",
    facilityType: "all",
  })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleFilterChange = useCallback(
    (key: keyof FilterState, value: string) => {
      const newFilters = { ...filters, [key]: value }
      setFilters(newFilters)
      onFiltersChange?.(newFilters)
    },
    [filters, onFiltersChange]
  )

  const clearFilters = useCallback(() => {
    const clearedFilters = {
      search: "",
      status: "all",
      state: "all",
      facilityType: "all",
      facilityName: "",
    }
    setFilters(clearedFilters)
    onFiltersChange?.(clearedFilters)
  }, [onFiltersChange])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await onRefresh?.()
      toast.success("Clinical sites refreshed")
    } catch (error) {
      toast.error("Failed to refresh data")
    } finally {
      setIsRefreshing(false)
    }
  }, [onRefresh])

  const activeFilterCount = Object.values(filters).filter(
    (value) => value !== "" && value !== "all"
  ).length

  return (
    <div className="space-y-4">
      {/* Main Action Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-wrap items-center gap-2 sm:gap-3 md:gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clinical sites..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="pl-10 w-full md:w-80 bg-background/50 backdrop-blur-sm"
            />
          </div>

          {/* Quick Filters */}
          <Select
            value={filters.status}
            onValueChange={(value) => handleFilterChange("status", value)}
          >
            <SelectTrigger className="w-full sm:w-40 bg-background/50 backdrop-blur-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          {/* Advanced Filters Toggle */}
          <Button
            variant="outline"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={cn(
              "relative bg-background/50 backdrop-blur-sm hover:bg-background/80",
              showAdvancedFilters && "bg-primary/10 text-primary border-primary/30"
            )}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown
              className={`ml-2 h-4 w-4 transition-transform ${showAdvancedFilters ? "rotate-180" : ""}`}
            />
          </Button>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="hover:bg-background/50"
            >
              Clear filters
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-background/50 backdrop-blur-sm hover:bg-background/80"
          >
            {isRefreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-background/50 backdrop-blur-sm hover:bg-background/80"
              >
                <Download className="mr-2 h-4 w-4" />
                Export
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-card-subtle">
              <DropdownMenuItem className="cursor-pointer focus:bg-primary/10">
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer focus:bg-primary/10">
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer focus:bg-primary/10">
                Export Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/dashboard/school-admin/setup">
            <Button
              variant="outline"
              className="w-full sm:w-auto bg-background/50 backdrop-blur-sm hover:bg-background/80"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import Sites
            </Button>
          </Link>

          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 shadow-lg hover:shadow-primary/20 transition-all"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Clinical Site
          </Button>

          {/* Add Clinical Site Dialog */}
          <ClinicalSiteFormDialog
            open={isAddDialogOpen}
            onOpenChange={setIsAddDialogOpen}
            onSuccess={() => {
              toast.success("Clinical site added successfully!")
              onRefresh?.()
            }}
          />
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="rounded-lg border bg-card p-4 glass-card-subtle card-hover-lift">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>State/Region</Label>
              <Select
                value={filters.state}
                onValueChange={(value) => handleFilterChange("state", value)}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="CA">California</SelectItem>
                  <SelectItem value="NY">New York</SelectItem>
                  <SelectItem value="TX">Texas</SelectItem>
                  <SelectItem value="FL">Florida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Facility Type</Label>
              <Select
                value={filters.facilityType}
                onValueChange={(value) => handleFilterChange("facilityType", value)}
              >
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {FACILITY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full bg-background/50 hover:bg-background/80"
              >
                <Settings className="mr-2 h-4 w-4" />
                Reset Filters
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
