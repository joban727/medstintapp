"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { revokeSeat } from "@/lib/payments/actions"
import { toast } from "sonner"
import { Loader2, Trash2 } from "lucide-react"

interface SeatAssignment {
  id: string
  studentId: string
  studentName: string
  studentEmail: string
  assignedAt: Date
  status: "ACTIVE" | "REVOKED"
}

interface SeatManagementTableProps {
  assignments: SeatAssignment[]
  schoolId: string
}

export function SeatManagementTable({ assignments, schoolId }: SeatManagementTableProps) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleRevoke = async (studentId: string) => {
    setLoadingId(studentId)
    try {
      const result = await revokeSeat(studentId, schoolId)
      if (result.status) {
        toast.success("Seat revoked successfully")
        router.refresh()
      } else {
        toast.error(result.message || "Failed to revoke seat")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Assigned Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No seats assigned yet.
              </TableCell>
            </TableRow>
          ) : (
            assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell className="font-medium">{assignment.studentName}</TableCell>
                <TableCell>{assignment.studentEmail}</TableCell>
                <TableCell>{new Date(assignment.assignedAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <Badge variant={assignment.status === "ACTIVE" ? "default" : "secondary"}>
                    {assignment.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {assignment.status === "ACTIVE" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(assignment.studentId)}
                      disabled={loadingId === assignment.studentId}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {loadingId === assignment.studentId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="sr-only">Revoke</span>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
