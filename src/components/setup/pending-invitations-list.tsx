"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { format } from "date-fns"

interface Invitation {
  id: string
  email: string
  programId: string
  cohortId: string
  status: "PENDING" | "ACCEPTED" | "EXPIRED"
  expiresAt: string
  createdAt: string
}

export function PendingInvitationsList() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInvitations = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/invitations")
      const data = await res.json()
      if (data.success) {
        setInvitations(data.data)
      } else {
        console.error("Failed to fetch invitations:", data.error)
      }
    } catch (error) {
      console.error("Failed to fetch invitations", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvitations()
  }, [])

  return (
    <Card className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Manage outstanding student invitations</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchInvitations}
            disabled={loading}
            className="hover:bg-muted/50 dark:hover:bg-white/10"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invitations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-muted/30 dark:bg-white/5 rounded-lg border border-border dark:border-white/10 border-dashed">
            <p>No pending invitations found.</p>
            <p className="text-xs mt-1 opacity-70">
              Invited students will appear here until they accept.
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-border dark:border-white/10 overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50 dark:bg-white/5">
                <TableRow className="hover:bg-transparent border-border dark:border-white/10">
                  <TableHead className="text-muted-foreground">Email</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Expires</TableHead>
                  <TableHead className="text-muted-foreground">Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invite) => (
                  <TableRow
                    key={invite.id}
                    className="hover:bg-muted/50 dark:hover:bg-white/5 border-border dark:border-white/10"
                  >
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-0",
                          invite.status === "PENDING" &&
                            "bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30",
                          invite.status === "ACCEPTED" &&
                            "bg-green-500/20 text-green-500 hover:bg-green-500/30",
                          invite.status === "EXPIRED" &&
                            "bg-red-500/20 text-red-500 hover:bg-red-500/30"
                        )}
                      >
                        {invite.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(invite.expiresAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(invite.createdAt), "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
