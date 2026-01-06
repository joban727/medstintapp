"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Edit2, Loader2, Plus, Target, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  getCompetenciesByProgram,
  createCompetency,
  deleteCompetency,
  updateCompetency,
} from "@/app/actions/competencies"

const competencySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  level: z.enum(["FUNDAMENTAL", "INTERMEDIATE", "ADVANCED", "EXPERT"]),
  isRequired: z.boolean().default(false),
})

interface Competency {
  id: string
  name: string
  description: string
  category: string
  level: string
  isRequired: boolean
  createdAt: Date
}

interface ManageCompetenciesModalProps {
  programId: string | null
  programName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CATEGORIES = [
  "Clinical Skills",
  "Patient Care",
  "Communication",
  "Professionalism",
  "Safety",
  "Documentation",
  "Technical Skills",
  "Critical Thinking",
  "Other",
]

const LEVELS = [
  { value: "FUNDAMENTAL", label: "Fundamental", color: "bg-blue-100 text-blue-800" },
  { value: "INTERMEDIATE", label: "Intermediate", color: "bg-yellow-100 text-yellow-800" },
  { value: "ADVANCED", label: "Advanced", color: "bg-orange-100 text-orange-800" },
  { value: "EXPERT", label: "Expert", color: "bg-red-100 text-red-800" },
]

export function ManageCompetenciesModal({
  programId,
  programName,
  open,
  onOpenChange,
}: ManageCompetenciesModalProps) {
  const [competencies, setCompetencies] = useState<Competency[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const form = useForm<z.infer<typeof competencySchema>>({
    resolver: zodResolver(competencySchema) as any,
    defaultValues: {
      name: "",
      description: "",
      category: "",
      level: "FUNDAMENTAL",
      isRequired: false,
    },
  })

  const fetchCompetencies = async () => {
    if (!programId) return
    setIsLoading(true)
    const result = await getCompetenciesByProgram(programId)
    if (result.success) {
      setCompetencies(result.data || [])
    } else {
      toast.error("Failed to load competencies")
    }
    setIsLoading(false)
  }

  useEffect(() => {
    if (open && programId) {
      fetchCompetencies()
      form.reset()
      setEditingId(null)
    }
  }, [open, programId])

  const onSubmit = async (data: z.infer<typeof competencySchema>) => {
    if (!programId) return
    setIsCreating(true)

    if (editingId) {
      const result = await updateCompetency(editingId, data)
      if (result.success) {
        toast.success("Competency updated successfully")
        form.reset()
        setEditingId(null)
        fetchCompetencies()
      } else {
        toast.error(result.error || "Failed to update competency")
      }
    } else {
      const result = await createCompetency({ ...data, programId })
      if (result.success) {
        toast.success("Competency created successfully")
        form.reset()
        fetchCompetencies()
      } else {
        toast.error(result.error || "Failed to create competency")
      }
    }
    setIsCreating(false)
  }

  const handleEdit = (competency: Competency) => {
    setEditingId(competency.id)
    form.reset({
      name: competency.name,
      description: competency.description,
      category: competency.category,
      level: competency.level as any,
      isRequired: competency.isRequired,
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    form.reset()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this competency?")) return
    const result = await deleteCompetency(id)
    if (result.success) {
      toast.success("Competency deleted")
      fetchCompetencies()
    } else {
      toast.error(result.error || "Failed to delete competency")
    }
  }

  const getLevelBadge = (level: string) => {
    const levelConfig = LEVELS.find((l) => l.value === level)
    return levelConfig ? (
      <Badge className={levelConfig.color}>{levelConfig.label}</Badge>
    ) : (
      <Badge variant="secondary">{level}</Badge>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Manage Competencies - {programName}
          </DialogTitle>
          <DialogDescription>
            Add and manage competency requirements for this program.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Create/Edit Competency Form */}
          <div className="rounded-lg border p-4 bg-muted/50">
            <h3 className="mb-4 font-semibold flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {editingId ? "Edit Competency" : "Add New Competency"}
            </h3>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Perform venipuncture" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the competency requirements..."
                          className="resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-3 items-end">
                  <FormField
                    control={form.control}
                    name="level"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty Level</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select level" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {LEVELS.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                {level.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">
                          Required for completion
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    {editingId && (
                      <Button type="button" variant="outline" onClick={handleCancelEdit}>
                        Cancel
                      </Button>
                    )}
                    <Button type="submit" disabled={isCreating} className="flex-1">
                      {isCreating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : editingId ? (
                        "Update"
                      ) : (
                        "Add Competency"
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </div>

          {/* Competencies List */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competency</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Required</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : competencies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No competencies found. Add one above.
                    </TableCell>
                  </TableRow>
                ) : (
                  competencies.map((competency) => (
                    <TableRow key={competency.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{competency.name}</div>
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {competency.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{competency.category}</Badge>
                      </TableCell>
                      <TableCell>{getLevelBadge(competency.level)}</TableCell>
                      <TableCell>
                        {competency.isRequired ? (
                          <Badge className="bg-green-100 text-green-800">Required</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Optional</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(competency)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(competency.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
