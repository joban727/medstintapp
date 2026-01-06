"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { createPlan, updatePlan } from "@/app/actions/admin/plans"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useState } from "react"
import { Plan } from "@/lib/payments/plans-service"

const planSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be positive"),
  interval: z.enum(["month", "year"]),
  stripePriceId: z.string().optional(),
  type: z.enum(["STUDENT_SUBSCRIPTION", "SCHOOL_SEAT"]).default("STUDENT_SUBSCRIPTION"),
  features: z.string(), // We'll handle this as a newline-separated string in the form
  trialDays: z.coerce.number().min(0).default(0),
  isActive: z.boolean().default(true),
})

interface PlanFormProps {
  plan?: Plan
}

export function PlanForm({ plan }: PlanFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  type PlanFormData = z.infer<typeof planSchema>

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema) as never,
    defaultValues: {
      name: plan?.name || "",
      description: plan?.description || "",
      price: plan?.price || 0,
      interval: plan?.interval || "month",
      stripePriceId: plan?.stripePriceId || "",
      type: plan?.type || "STUDENT_SUBSCRIPTION",
      features: plan?.features.join("\n") || "",
      trialDays: plan?.trialDays || 0,
      isActive: plan?.isActive ?? true,
    },
  })

  async function onSubmit(values: z.infer<typeof planSchema>) {
    setIsPending(true)
    try {
      const formattedValues = {
        ...values,
        features: values.features.split("\n").filter((f) => f.trim() !== ""),
      }

      let result
      if (plan) {
        result = await updatePlan(plan.id, formattedValues)
      } else {
        result = await createPlan(formattedValues)
      }

      if (result.success) {
        toast.success(result.message)
        router.push("/dashboard/admin/plans")
        router.refresh()
      } else {
        toast.error(result.message)
      }
    } catch (error) {
      toast.error("Something went wrong")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-2xl">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plan Name</FormLabel>
              <FormControl>
                <Input placeholder="Pro Plan" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Plan Type</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="STUDENT_SUBSCRIPTION">Student Subscription</SelectItem>
                  <SelectItem value="SCHOOL_SEAT">School Seat</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="interval"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing Interval</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select interval" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="month">Monthly</SelectItem>
                    <SelectItem value="year">Yearly</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="stripePriceId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Stripe Price ID</FormLabel>
              <FormControl>
                <Input placeholder="price_..." {...field} />
              </FormControl>
              <FormDescription>
                The Price ID from your Stripe Dashboard (e.g. price_12345). If left empty, a new
                Product and Price will be created in Stripe.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="features"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Features (one per line)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Feature 1&#10;Feature 2"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Active Status</FormLabel>
                <FormDescription>
                  Inactive plans are hidden from users but existing subscriptions continue.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-4">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : plan ? "Update Plan" : "Create Plan"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
