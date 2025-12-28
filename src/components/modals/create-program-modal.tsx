// TODO: Add cache invalidation hooks for mutations
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea"

const createProgramSchema = z.object({
  name: z.string().min(1, "Program name is required"),
  description: z.string().min(1, "Description is required"),
  duration: z.number().min(1, "Duration must be at least 1 month"),
})

type CreateProgramFormData = z.infer<typeof createProgramSchema>

interface CreateProgramModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  schoolId: string
}

export function CreateProgramModal({
  open,
  onOpenChange,
  onSuccess,
  schoolId,
}: CreateProgramModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<CreateProgramFormData>({
    resolver: zodResolver(createProgramSchema),
    defaultValues: {
      name: "",
      description: "",
      duration: 12,
    },
  })

  const onSubmit = async (data: CreateProgramFormData) => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/programs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          schoolId,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch((err) => {
          console.error("Failed to parse JSON response:", err)
          throw new Error("Invalid response format")
        })
        throw new Error(error.error || "Failed to create program")
      }

      toast.success("Program created successfully!")
      form.reset()
      onOpenChange(false)
      onSuccess()
    } catch (error) {
      // Error creating program
      toast.error(error instanceof Error ? error.message : "Failed to create program")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Create New Program</DialogTitle>
          <DialogDescription>
            Add a new academic program to your school. The program will automatically be structured
            with a class year based on the current year plus the program duration.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="gap-6" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program Name *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Nursing Program"
                        aria-label="e.g., Nursing Program"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (months) *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        placeholder="12"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
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
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the program objectives, curriculum, and outcomes..."
                      aria-label="Describe the program objectives, curriculum, and outcomes..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950/20">
              <p className="text-blue-700 text-sm dark:text-blue-300">
                <strong>Note:</strong> Programs will automatically be formatted as "Program Name -
                Class of {new Date().getFullYear() + 4}" (example for a 4-year program). The class
                year is calculated based on the current year plus the program duration.
              </p>
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
                Create Program
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
