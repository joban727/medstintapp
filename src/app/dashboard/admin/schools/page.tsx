"use client"

import { useAuth } from "@clerk/nextjs"
import { Building2, Edit, Link, MoreHorizontal, Plus, Search, Trash2, Unlink } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Badge } from "../../../../components/ui/badge"
import { Button } from "../../../../components/ui/button"
import type { UserRole } from "@/types"

// Role validation utilities
const hasRole = (userRole: UserRole, allowedRoles: UserRole[]): boolean => {
  return allowedRoles.includes(userRole)
}

const isAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, ["ADMIN" as UserRole, "SUPER_ADMIN" as UserRole])
}

const isSchoolAdmin = (userRole: UserRole): boolean => {
  return hasRole(userRole, [
    "SCHOOL_ADMIN" as UserRole,
    "ADMIN" as UserRole,
    "SUPER_ADMIN" as UserRole,
  ])
}
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card"
import { Checkbox } from "../../../../components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../../components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../../components/ui/dropdown-menu"
import { Input } from "../../../../components/ui/input"
import { Label } from "../../../../components/ui/label"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../../components/ui/tabs"
import { useFieldIds } from "../../../../hooks/use-unique-id"

interface School {
  id: string
  name: string
  address: string
  email: string
  phone: string
  website?: string
  adminId: string | null
  isActive: boolean
  createdAt: string
  userCount?: number
}

interface User {
  id: string
  name: string
  email: string
  role: string
  schoolId: string | null
  schoolName?: string
  createdAt: string
}

export default function SchoolsManagementPage() {
  const fieldIds = useFieldIds([
    "name",
    "address",
    "email",
    "phone",
    "editName",
    "editAddress",
    "editEmail",
    "editPhone",
  ])
  const [schools, setSchools] = useState<School[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [unlinkedUsers, setUnlinkedUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedSchool, setSelectedSchool] = useState<string>("")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
  const [editingSchool, setEditingSchool] = useState<School | null>(null)

  const { getToken } = useAuth()

  // Form states
  const [newSchool, setNewSchool] = useState({
    name: "",
    address: "",
    email: "",
    phone: "",
  })

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      const token = await getToken()

      // Fetch schools
      const schoolsResponse = await fetch("/api/schools", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (schoolsResponse.ok) {
        const schoolsData = await schoolsResponse.json()
        setSchools(schoolsData.schools || [])
      }

      // Fetch all users
      const usersResponse = await fetch("/api/users", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (usersResponse.ok) {
        const usersData = await usersResponse.json()
        setUsers(usersData.users || [])
      }

      // Fetch unlinked users
      const unlinkedResponse = await fetch("/api/users/link-school/unlinked", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
      if (unlinkedResponse.ok) {
        const unlinkedData = await unlinkedResponse.json()
        setUnlinkedUsers(unlinkedData.unlinkedUsers || [])
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateSchool = async () => {
    try {
      const token = await getToken()
      const response = await fetch("/api/schools/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: newSchool.name,
          address: newSchool.address,
          email: newSchool.email,
          phone: newSchool.phone,
        }),
      })

      if (response.ok) {
        toast.success("School created successfully")
        setIsCreateDialogOpen(false)
        setNewSchool({ name: "", address: "", email: "", phone: "" })
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to create school")
      }
    } catch (error) {
      console.error("Error creating school:", error)
      toast.error("Failed to create school")
    }
  }

  const handleUpdateSchool = async () => {
    if (!editingSchool) return

    try {
      const token = await getToken()
      const response = await fetch(`/api/schools/${editingSchool.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: editingSchool.name,
          address: editingSchool.address,
          email: editingSchool.email,
          phone: editingSchool.phone,
        }),
      })

      if (response.ok) {
        toast.success("School updated successfully")
        setEditingSchool(null)
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to update school")
      }
    } catch (error) {
      console.error("Error updating school:", error)
      toast.error("Failed to update school")
    }
  }

  const handleDeactivateSchool = async (schoolId: string) => {
    try {
      const token = await getToken()
      const response = await fetch(`/api/schools/${schoolId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (response.ok) {
        toast.success("School deactivated successfully")
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to deactivate school")
      }
    } catch (error) {
      console.error("Error deactivating school:", error)
      toast.error("Failed to deactivate school")
    }
  }

  const handleLinkUsers = async () => {
    if (!selectedSchool || selectedUsers.length === 0) {
      toast.error("Please select a school and at least one user")
      return
    }

    try {
      const token = await getToken()
      const response = await fetch("/api/users/link-school/bulk", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userIds: selectedUsers,
          schoolId: selectedSchool,
        }),
      })

      if (response.ok) {
        toast.success("Users linked to school successfully")
        setIsLinkDialogOpen(false)
        setSelectedUsers([])
        setSelectedSchool("")
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to link users")
      }
    } catch (error) {
      console.error("Error linking users:", error)
      toast.error("Failed to link users")
    }
  }

  const handleUnlinkUser = async (userId: string) => {
    try {
      const token = await getToken()
      const response = await fetch(`/api/users/link-school?userId=${userId}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      if (response.ok) {
        toast.success("User unlinked from school successfully")
        fetchData()
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to unlink user")
      }
    } catch (error) {
      console.error("Error unlinking user:", error)
      toast.error("Failed to unlink user")
    }
  }

  const filteredSchools = schools.filter(
    (school) =>
      school.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      school.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">School Management</h1>
          <p className="text-muted-foreground">Manage schools and user-school relationships</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Link className="mr-2 h-4 w-4" />
                Link Users
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Link Users to School</DialogTitle>
                <DialogDescription>
                  Select unlinked users and assign them to a school
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="school-select">Select School</Label>
                  <Select value={selectedSchool} onValueChange={setSelectedSchool}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map((school) => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Select Users ({unlinkedUsers.length} unlinked)</Label>
                  <div className="max-h-64 overflow-y-auto rounded-md border p-2">
                    {unlinkedUsers.map((user) => (
                      <div key={user.id} className="flex items-center space-x-2 py-2">
                        <Checkbox
                          id={user.id}
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedUsers([...selectedUsers, user.id])
                            } else {
                              setSelectedUsers(selectedUsers.filter((id) => id !== user.id))
                            }
                          }}
                        />
                        <label htmlFor={user.id} className="flex-1 cursor-pointer">
                          <div className="font-medium">{user.name}</div>
                          <div className="text-muted-foreground text-sm">{user.email}</div>
                        </label>
                        <Badge variant="outline">{user.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleLinkUsers}>Link {selectedUsers.length} Users</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add School
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New School</DialogTitle>
                <DialogDescription>Add a new school to the system</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor={fieldIds.name}>School Name</Label>
                  <Input
                    id={fieldIds.name}
                    value={newSchool.name}
                    onChange={(e) => setNewSchool({ ...newSchool, name: e.target.value })}
                    placeholder="Enter school name"
                  />
                </div>
                <div>
                  <Label htmlFor={fieldIds.address}>Address</Label>
                  <Input
                    id={fieldIds.address}
                    value={newSchool.address}
                    onChange={(e) => setNewSchool({ ...newSchool, address: e.target.value })}
                    placeholder="Enter school address"
                  />
                </div>
                <div>
                  <Label htmlFor={fieldIds.email}>Contact Email</Label>
                  <Input
                    id={fieldIds.email}
                    type="email"
                    value={newSchool.email}
                    onChange={(e) => setNewSchool({ ...newSchool, email: e.target.value })}
                    placeholder="Enter contact email"
                  />
                </div>
                <div>
                  <Label htmlFor={fieldIds.phone}>Contact Phone</Label>
                  <Input
                    id={fieldIds.phone}
                    value={newSchool.phone}
                    onChange={(e) => setNewSchool({ ...newSchool, phone: e.target.value })}
                    placeholder="Enter contact phone"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateSchool}>Create School</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="schools" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schools">Schools</TabsTrigger>
          <TabsTrigger value="users">User-School Links</TabsTrigger>
          <TabsTrigger value="unlinked">Unlinked Users</TabsTrigger>
        </TabsList>

        <TabsContent value="schools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schools Overview</CardTitle>
              <CardDescription>Manage all schools in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Search schools..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSchools.map((school) => (
                    <TableRow key={school.id}>
                      <TableCell className="font-medium">{school.name}</TableCell>
                      <TableCell>{school.address}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{school.email}</div>
                          <div className="text-muted-foreground">{school.phone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={school.isActive ? "default" : "secondary"}>
                          {school.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {users.filter((u) => u.schoolId === school.id).length} users
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
                            <DropdownMenuItem onClick={() => setEditingSchool(school)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeactivateSchool(school.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User-School Relationships</CardTitle>
              <CardDescription>View and manage user assignments to schools</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex items-center space-x-2">
                <Search className="h-4 w-4" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers
                    .filter((user) => user.schoolId)
                    .map((user) => {
                      const school = schools.find((s) => s.id === user.schoolId)
                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{user.name}</div>
                              <div className="text-muted-foreground text-sm">{user.email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.role}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Building2 className="mr-2 h-4 w-4" />
                              {school?.name || "Unknown School"}
                            </div>
                          </TableCell>
                          <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUnlinkUser(user.id)}
                            >
                              <Unlink className="mr-2 h-4 w-4" />
                              Unlink
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unlinked" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Unlinked Users</CardTitle>
              <CardDescription>
                Users not assigned to any school ({unlinkedUsers.length} total)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unlinkedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-muted-foreground text-sm">{user.email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{user.role}</Badge>
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUsers([user.id])
                            setIsLinkDialogOpen(true)
                          }}
                        >
                          <Link className="mr-2 h-4 w-4" />
                          Link to School
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit School Dialog */}
      <Dialog open={!!editingSchool} onOpenChange={() => setEditingSchool(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit School</DialogTitle>
            <DialogDescription>Update school information</DialogDescription>
          </DialogHeader>
          {editingSchool && (
            <div className="space-y-4">
              <div>
                <Label htmlFor={fieldIds.editName}>School Name</Label>
                <Input
                  id={fieldIds.editName}
                  value={editingSchool.name}
                  onChange={(e) => setEditingSchool({ ...editingSchool, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={fieldIds.editAddress}>Address</Label>
                <Input
                  id={fieldIds.editAddress}
                  value={editingSchool.address}
                  onChange={(e) => setEditingSchool({ ...editingSchool, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={fieldIds.editEmail}>Contact Email</Label>
                <Input
                  id={fieldIds.editEmail}
                  type="email"
                  value={editingSchool.email}
                  onChange={(e) => setEditingSchool({ ...editingSchool, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={fieldIds.editPhone}>Contact Phone</Label>
                <Input
                  id={fieldIds.editPhone}
                  value={editingSchool.phone}
                  onChange={(e) => setEditingSchool({ ...editingSchool, phone: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSchool(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSchool}>Update School</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
