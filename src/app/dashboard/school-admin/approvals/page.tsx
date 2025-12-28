"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, User, Clock } from "lucide-react"
import { toast } from "sonner"

interface PendingUser {
    id: string
    name: string
    email: string
    role: string
    programId: string | null
    createdAt: string
}

export default function ApprovalsPage() {
    const [users, setUsers] = useState<PendingUser[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<string | null>(null)

    useEffect(() => {
        fetchPendingUsers()
    }, [])

    const fetchPendingUsers = async () => {
        try {
            const response = await fetch("/api/school-admin/approvals")
            const data = await response.json()
            if (data.success) {
                setUsers(data.data)
            } else {
                toast.error("Failed to fetch pending approvals")
            }
        } catch (error) {
            console.error("Error fetching approvals:", error)
            toast.error("An error occurred while fetching approvals")
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (userId: string, action: "APPROVE" | "REJECT") => {
        setProcessing(userId)
        try {
            const response = await fetch("/api/school-admin/approvals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ targetUserId: userId, action }),
            })
            const data = await response.json()

            if (data.success) {
                toast.success(`User ${action === "APPROVE" ? "approved" : "rejected"} successfully`)
                setUsers(users.filter((u) => u.id !== userId))
            } else {
                toast.error(data.error || "Failed to process request")
            }
        } catch (error) {
            console.error("Error processing approval:", error)
            toast.error("An error occurred")
        } finally {
            setProcessing(null)
        }
    }

    if (loading) {
        return <div className="p-8 text-center">Loading pending approvals...</div>
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Pending Approvals</h1>
                    <p className="text-muted-foreground">
                        Review and approve new account requests.
                    </p>
                </div>
            </div>

            {users.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-4 rounded-full bg-green-100 p-3">
                            <CheckCircle2 className="h-6 w-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-medium">All Caught Up</h3>
                        <p className="text-muted-foreground">
                            There are no pending account requests at this time.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {users.map((user) => (
                        <Card key={user.id}>
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                                            <User className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{user.name || "Unnamed User"}</CardTitle>
                                            <CardDescription>{user.email}</CardDescription>
                                        </div>
                                    </div>
                                    <div className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                                        Pending
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-4 space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Role:</span>
                                        <span className="font-medium">{user.role}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Requested:</span>
                                        <span className="font-medium">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                        onClick={() => handleAction(user.id, "APPROVE")}
                                        disabled={processing === user.id}
                                    >
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Approve
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="flex-1"
                                        onClick={() => handleAction(user.id, "REJECT")}
                                        disabled={processing === user.id}
                                    >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Reject
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
