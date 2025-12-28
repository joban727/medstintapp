// TODO: Add cache invalidation hooks for mutations
"use client"

import { Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const validateEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

interface AddFacultyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AddFacultyModal({ open, onOpenChange, onSuccess }: AddFacultyModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "",
    department: "",
    password: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setIsSubmitting(true)

    try {
      // Validate form data
      if (
        !formData.name ||
        !formData.email ||
        !formData.role ||
        !formData.department ||
        !formData.password
      ) {
        toast.error("Please fill in all required fields")
        return
      }

      // Email validation
      if (!validateEmail(formData.email)) {
        toast.error("Please enter a valid email address")
        return
      }

      // Password validation
      if (formData.password.length < 8) {
        toast.error("Password must be at least 8 characters long")
        return
      }

      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          status: "ACTIVE",
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch((err) => {
          console.error("Failed to parse JSON response:", err)
          throw new Error("Invalid response format")
        })
        throw new Error(error.message || "Failed to create faculty member")
      }

      toast.success("Faculty member added successfully")
      onSuccess?.()
      onOpenChange(false)

      // Reset form
      setFormData({
        name: "",
        email: "",
        role: "",
        department: "",
        password: "",
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      console.error("[AddFacultyModal] Operation failed:", error)
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Faculty Member</DialogTitle>
          <DialogDescription>
            Create a new faculty account. They will receive login credentials via email.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="gap-4" noValidate>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Full Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="col-span-3"
                placeholder="Dr. John Smith"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email *
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="col-span-3"
                placeholder="john.smith@university.edu"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Role *
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => handleInputChange("role", value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLINICAL_SUPERVISOR">Clinical Supervisor</SelectItem>
                  <SelectItem value="SCHOOL_ADMIN">School Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="department" className="text-right">
                Department *
              </Label>
              <Select
                value={formData.department}
                onValueChange={(value) => handleInputChange("department", value)}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General Radiology">General Radiology</SelectItem>
                  <SelectItem value="MRI">MRI</SelectItem>
                  <SelectItem value="CT Scan">CT Scan</SelectItem>
                  <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                  <SelectItem value="Nuclear Medicine">Nuclear Medicine</SelectItem>
                  <SelectItem value="Radiation Therapy">Radiation Therapy</SelectItem>
                  <SelectItem value="Administration">Administration</SelectItem>
                  <SelectItem value="Academic Affairs">Academic Affairs</SelectItem>
                  <SelectItem value="Student Services">Student Services</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Password *
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                className="col-span-3"
                placeholder="Minimum 8 characters"
                required
                minLength={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Faculty Member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
