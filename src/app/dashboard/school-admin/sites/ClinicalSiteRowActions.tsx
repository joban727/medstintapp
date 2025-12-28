"use client"

import { useState } from "react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ClinicalSiteFormDialog } from "./ClinicalSiteFormDialog"

interface ClinicalSiteRowActionsProps {
    site: any // Using any for now to match the implicit type in page.tsx, ideally should be typed
}

export function ClinicalSiteRowActions({ site }: ClinicalSiteRowActionsProps) {
    const [isEditOpen, setIsEditOpen] = useState(false)

    const handleEdit = () => {
        setIsEditOpen(true)
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-background/80">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="glass-card-subtle">
                    <DropdownMenuItem
                        className="cursor-pointer focus:bg-primary/10"
                        onClick={handleEdit}
                    >
                        Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer focus:bg-primary/10">
                        View
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600 cursor-pointer focus:bg-red-50 dark:focus:bg-red-900/20">
                        Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ClinicalSiteFormDialog
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                initialData={{
                    id: site.id,
                    facilityName: site.name,
                    facilityType: site.facilityType || "hospital", // Default if missing
                    address: site.address,
                    latitude: site.latitude || "", // Assuming these might be missing in the view model
                    longitude: site.longitude || "",
                    geofenceRadius: site.geofenceRadius || 100,
                    strictGeofence: site.strictGeofence || false,
                    priority: site.priority || 0,
                    clinicalSiteId: site.clinicalSiteId,
                    contactName: site.contactPerson,
                    contactEmail: site.contactEmail,
                    contactPhone: site.contactPhone,
                    notes: site.notes,
                }}
            />
        </>
    )
}
