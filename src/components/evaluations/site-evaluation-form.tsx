"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { StarRating } from "@/components/ui/star-rating"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

const formSchema = z.object({
  rating: z.number().min(1, "Please provide an overall rating").max(5),
  learningOpportunitiesRating: z.number().min(1).max(5),
  preceptorSupportRating: z.number().min(1).max(5),
  facilityQualityRating: z.number().min(1).max(5),
  feedback: z.string().min(10, "Feedback must be at least 10 characters"),
  recommendToOthers: z.boolean(),
  isAnonymous: z.boolean(),
})

interface SiteEvaluationFormProps {
  rotationId: string
  clinicalSiteId: string
  clinicalSiteName: string
  preceptorId?: string
  onSuccess?: () => void
}

export function SiteEvaluationForm({
  rotationId,
  clinicalSiteId,
  clinicalSiteName,
  preceptorId,
  onSuccess,
}: SiteEvaluationFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { toast } = useToast()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rating: 0,
      learningOpportunitiesRating: 0,
      preceptorSupportRating: 0,
      facilityQualityRating: 0,
      feedback: "",
      recommendToOthers: true,
      isAnonymous: false,
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true)
    try {
      const response = await fetch("/api/evaluations/site", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          rotationId,
          clinicalSiteId,
          preceptorId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit evaluation")
      }

      toast({
        title: "Evaluation submitted",
        description: "Thank you for your feedback!",
      })
      onSuccess?.()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Site Evaluation</CardTitle>
        <CardDescription>
          Please share your experience at {clinicalSiteName}. Your feedback helps us improve
          clinical placements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overall Rating</FormLabel>
                    <FormControl>
                      <StarRating value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="learningOpportunitiesRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Learning Opportunities</FormLabel>
                    <FormControl>
                      <StarRating value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="preceptorSupportRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preceptor Support</FormLabel>
                    <FormControl>
                      <StarRating value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="facilityQualityRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facility Quality</FormLabel>
                    <FormControl>
                      <StarRating value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="feedback"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Detailed Feedback</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What did you like? What could be improved?"
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Be specific about your clinical experience and learning environment.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg bg-muted/30">
              <FormField
                control={form.control}
                name="recommendToOthers"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-2 space-y-0">
                    <div>
                      <FormLabel>Recommend to others?</FormLabel>
                      <FormDescription>
                        Would you recommend this site to other students?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg bg-muted/30">
              <FormField
                control={form.control}
                name="isAnonymous"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-2 space-y-0">
                    <div>
                      <FormLabel>Submit Anonymously</FormLabel>
                      <FormDescription>
                        Your name will not be visible to the clinical site.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Evaluation
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
