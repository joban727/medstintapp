"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
import { debouncedLocationCapture } from "@/lib/location-debouncer"
import { openMapService } from "@/lib/openmap-service"

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

interface FacilityFormData {
    id?: string
    facilityName: string
    facilityType: string
    address: string
    latitude: string
    longitude: string
    geofenceRadius: number
    strictGeofence: boolean
    priority: number
    clinicalSiteId?: string
    contactName?: string
    contactEmail?: string
    contactPhone?: string
    notes?: string
}

interface ClinicalSiteFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: FacilityFormData
    onSuccess?: () => void
}

export function ClinicalSiteFormDialog({
    open,
    onOpenChange,
    initialData,
    onSuccess,
}: ClinicalSiteFormDialogProps) {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const dialogRef = useRef<HTMLDivElement>(null)

    const [formData, setFormData] = useState<FacilityFormData>({
        facilityName: "",
        facilityType: "hospital",
        address: "",
        latitude: "",
        longitude: "",
        geofenceRadius: 100,
        strictGeofence: false,
        priority: 0,
        clinicalSiteId: undefined,
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        notes: "",
    })

    const [isGeocoding, setIsGeocoding] = useState(false)
    const [geoError, setGeoError] = useState<string | null>(null)

    useEffect(() => {
        if (open) {
            if (initialData) {
                setFormData({
                    ...initialData,
                    latitude: String(initialData.latitude),
                    longitude: String(initialData.longitude),
                })
            } else {
                // Reset to defaults for add mode
                setFormData({
                    facilityName: "",
                    facilityType: "hospital",
                    address: "",
                    latitude: "",
                    longitude: "",
                    geofenceRadius: 100,
                    strictGeofence: false,
                    priority: 0,
                    clinicalSiteId: undefined,
                    contactName: "",
                    contactEmail: "",
                    contactPhone: "",
                    notes: "",
                })
            }
            setError(null)
            setGeoError(null)
        }
    }, [open, initialData])

    const handleAddressChange = async (value: string) => {
        setFormData((prev) => ({ ...prev, address: value }))
        setGeoError(null)

        const input = value.trim()
        if (input.length < 5) {
            setFormData((prev) => ({ ...prev, latitude: "", longitude: "" }))
            return
        }

        const hasComma = input.includes(",")
        const hasDigit = /\d/.test(input)
        if (!hasComma || !hasDigit) {
            setGeoError("Enter a complete street address, city, state, ZIP")
            setFormData((prev) => ({ ...prev, latitude: "", longitude: "" }))
            return
        }

        setIsGeocoding(true)
        try {
            const result = await debouncedLocationCapture("clinical-site-geocode", () =>
                openMapService.geocodeAddress(input)
            )
            setFormData((prev) => ({
                ...prev,
                latitude: result.latitude.toFixed(6),
                longitude: result.longitude.toFixed(6),
            }))
        } catch (err: any) {
            const msg = err?.message || "Failed to geocode address"
            setGeoError(msg)
        } finally {
            setIsGeocoding(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const latitudeNum = Number.parseFloat(formData.latitude)
            const longitudeNum = Number.parseFloat(formData.longitude)

            if (Number.isNaN(latitudeNum) || Number.isNaN(longitudeNum)) {
                const errorMsg = "Latitude and longitude must be valid numbers"
                setError(errorMsg)
                toast.error(errorMsg)
                setLoading(false)
                return
            }

            const payload = {
                facilityName: formData.facilityName.trim(),
                facilityType: formData.facilityType,
                address: formData.address.trim(),
                latitude: latitudeNum,
                longitude: longitudeNum,
                geofenceRadius: formData.geofenceRadius,
                strictGeofence: formData.strictGeofence,
                isActive: true,
                isCustom: true,
                priority: formData.priority,
                clinicalSiteId: formData.clinicalSiteId || undefined,
                contactInfo: {
                    contactName: formData.contactName?.trim() || undefined,
                    email: formData.contactEmail?.trim() || undefined,
                    phone: formData.contactPhone?.trim() || undefined,
                },
                notes: formData.notes?.trim() || undefined,
            }

            const isEdit = !!initialData?.id
            const url = "/api/facility-management"
            const method = isEdit ? "PUT" : "POST"
            const body = isEdit ? { ...payload, id: initialData.id } : payload

            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            })

            if (response.ok) {
                toast.success(`Clinical site ${isEdit ? "updated" : "created"} successfully`)
                onOpenChange(false)
                onSuccess?.()
                router.refresh()
            } else {
                const errorData = await response.json()
                const errorMsg = errorData?.error || `Failed to ${isEdit ? "update" : "create"} clinical site`
                setError(errorMsg)
                toast.error(errorMsg)
            }
        } catch (err) {
            console.error(`Error ${initialData ? "updating" : "creating"} clinical site:`, err)
            const errorMsg = `Error ${initialData ? "updating" : "creating"} clinical site`
            setError(errorMsg)
            toast.error(errorMsg)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[640px]"
                ref={dialogRef}
                onPointerDownOutside={(e) => {
                    if (loading) e.preventDefault()
                }}
                onEscapeKeyDown={(e) => {
                    if (loading) e.preventDefault()
                }}
            >
                <DialogHeader>
                    <DialogTitle>{initialData ? "Edit Clinical Site" : "Add New Clinical Site"}</DialogTitle>
                    <DialogDescription>
                        {initialData
                            ? "Update details for this clinical site."
                            : "Create a new clinical site for managing rotations and partnerships."}
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="facilityName">Site Name</Label>
                            <Input
                                id="facilityName"
                                value={formData.facilityName}
                                onChange={(e) => setFormData((prev) => ({ ...prev, facilityName: e.target.value }))}
                                placeholder="e.g., St. Mary Hospital"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="facilityType">Site Type</Label>
                            <Select
                                value={formData.facilityType}
                                onValueChange={(value) => setFormData((prev) => ({ ...prev, facilityType: value }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {FACILITY_TYPES.map((type) => (
                                        <SelectItem key={type.value} value={type.value}>
                                            {type.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="address" className="flex items-center gap-2">
                            Address {isGeocoding && <Loader2 className="h-4 w-4 animate-spin" />}
                        </Label>
                        {geoError && <div className="text-red-600 text-xs">{geoError}</div>}
                        <Textarea
                            id="address"
                            value={formData.address}
                            onChange={(e) => handleAddressChange(e.target.value)}
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
                                placeholder="0.000000"
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
                                onChange={(e) => setFormData((prev) => ({ ...prev, longitude: e.target.value }))}
                                placeholder="0.000000"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="geofenceRadius">Geofence Radius (meters)</Label>
                            <Input
                                id="geofenceRadius"
                                type="number"
                                min={10}
                                max={1000}
                                value={formData.geofenceRadius}
                                onChange={(e) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        geofenceRadius: Number.parseInt(e.target.value) || 100,
                                    }))
                                }
                                required
                            />
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="strictGeofence"
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={formData.strictGeofence}
                            onChange={(e) =>
                                setFormData((prev) => ({ ...prev, strictGeofence: e.target.checked }))
                            }
                        />
                        <Label htmlFor="strictGeofence" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                            Strict Geofencing
                        </Label>
                        <span className="text-xs text-muted-foreground ml-2">
                            (Prevent clock-in/out if outside radius)
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes (optional)</Label>
                            <Textarea
                                id="notes"
                                value={formData.notes || ""}
                                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                                placeholder="Relevant notes about this clinical site"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="contactName">Contact Name (optional)</Label>
                            <Input
                                id="contactName"
                                value={formData.contactName || ""}
                                onChange={(e) => setFormData((prev) => ({ ...prev, contactName: e.target.value }))}
                                placeholder="Jane Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contactEmail">Contact Email (optional)</Label>
                            <Input
                                id="contactEmail"
                                type="email"
                                value={formData.contactEmail || ""}
                                onChange={(e) => setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))}
                                placeholder="jane@example.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="contactPhone">Contact Phone (optional)</Label>
                            <Input
                                id="contactPhone"
                                value={formData.contactPhone || ""}
                                onChange={(e) => setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))}
                                placeholder="(123) 456-7890"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={
                                loading ||
                                !formData.facilityName.trim() ||
                                !formData.address.trim() ||
                                isGeocoding ||
                                !!geoError ||
                                !formData.latitude ||
                                !formData.longitude ||
                                Number.isNaN(Number.parseFloat(formData.latitude)) ||
                                Number.isNaN(Number.parseFloat(formData.longitude))
                            }
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {initialData ? "Updating..." : "Adding..."}
                                </>
                            ) : (
                                initialData ? "Update Clinical Site" : "Add Clinical Site"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
