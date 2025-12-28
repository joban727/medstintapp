"use client"

import { useRouter } from "next/navigation"
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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

interface TimeRecordsFilterFormProps {
  defaultValues: {
    search?: string
    status?: string
    dateFrom?: string
    dateTo?: string
  }
}

export function TimeRecordsFilterForm({ defaultValues }: TimeRecordsFilterFormProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  const handleClearFilters = () => {
    if (formRef.current) {
      formRef.current.reset()
      router.push(window.location.pathname)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters</CardTitle>
        <CardDescription>Filter timecard records by various criteria</CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} method="GET" className="gap-4" noValidate>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="gap-2">
              <label className="font-medium text-sm">Search</label>
              <Input
                placeholder="Student name, email, or rotation..."
                aria-label="Student name, email, or rotation..."
                defaultValue={defaultValues.search || ""}
                name="search"
              />
            </div>
            <div className="gap-2">
              <label className="font-medium text-sm">Status</label>
              <Select
                aria-label="All statuses"
                defaultValue={defaultValues.status || "all"}
                name="status"
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="gap-2">
              <label className="font-medium text-sm">Date From</label>
              <Input type="date" defaultValue={defaultValues.dateFrom || ""} name="dateFrom" />
            </div>
            <div className="gap-2">
              <label className="font-medium text-sm">Date To</label>
              <Input type="date" defaultValue={defaultValues.dateTo || ""} name="dateTo" />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button type="submit">Apply Filters</Button>
            <Button variant="outline" type="button" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
