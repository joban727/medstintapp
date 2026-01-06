"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { CheckCircle, CreditCard, School, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { checkSchoolBillingStatus, assignSeat, createSubscription } from "@/lib/payments/actions"
import { toast } from "sonner"

interface SubscriptionStepProps {
  schoolId: string
  studentId: string
  onComplete: () => void
  onBack: () => void
}

export function SubscriptionStep({
  schoolId,
  studentId,
  onComplete,
  onBack,
}: SubscriptionStepProps) {
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [schoolPays, setSchoolPays] = useState(false)
  const [seatsAvailable, setSeatsAvailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await checkSchoolBillingStatus(schoolId)
        setSchoolPays(status.supported)
        setSeatsAvailable(status.seatsAvailable)
      } catch (err) {
        console.error(err)
        setError("Failed to check subscription options")
      } finally {
        setLoading(false)
      }
    }
    checkStatus()
  }, [schoolId])

  const handleSchoolSeatAssignment = async () => {
    setProcessing(true)
    try {
      const result = await assignSeat(studentId, schoolId)
      if (result.status) {
        toast.success("School license assigned successfully!")
        onComplete()
      } else {
        setError(result.message || "Failed to assign seat")
        toast.error(result.message || "Failed to assign seat")
      }
    } catch (err) {
      toast.error("An error occurred")
    } finally {
      setProcessing(false)
    }
  }

  const handleStripeCheckout = async () => {
    setProcessing(true)
    try {
      // Use student plan price ID (should be in env, fallback to hardcoded or fail)
      const priceId = process.env.NEXT_PUBLIC_STRIPE_STUDENT_PRICE_ID
      if (!priceId) {
        toast.error("Student pricing not configured")
        return
      }

      const result = await createSubscription(
        priceId,
        window.location.href + "?session_id={CHECKOUT_SESSION_ID}", // Return to onboarding
        window.location.href
      )

      if (result.status && result.url) {
        window.location.href = result.url
      } else {
        toast.error(result.message || "Failed to start checkout")
      }
    } catch (err) {
      toast.error("An error occurred")
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="space-y-1">
        <h3 className="text-2xl font-semibold tracking-tight">Subscription</h3>
        <p className="text-muted-foreground">Select how you would like to access MedStint.</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {schoolPays && seatsAvailable ? (
          <Card className="border-primary bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5 text-primary" />
                School-Paid License
              </CardTitle>
              <CardDescription>Your school covers your subscription cost.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-green-600 mb-4">
                <CheckCircle className="h-4 w-4" />
                <span>License available</span>
              </div>
              <Button onClick={handleSchoolSeatAssignment} disabled={processing} className="w-full">
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Claim License & Continue
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Student Subscription
              </CardTitle>
              <CardDescription>
                Full access to all features for your clinical rotations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-2xl font-bold">
                $2.00 <span className="text-sm font-normal text-muted-foreground">/ month</span>
              </div>
              {schoolPays && !seatsAvailable && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your school's licenses are currently fully used. You can subscribe personally to
                    continue.
                  </AlertDescription>
                </Alert>
              )}
              <Button onClick={handleStripeCheckout} disabled={processing} className="w-full">
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Subscribe Now
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-start">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
    </motion.div>
  )
}
