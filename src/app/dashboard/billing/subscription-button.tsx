"use client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "../../../components/ui/button"
import { updateExistingSubscription } from "../../../lib/payments/actions"
import type { Plan } from "../../../lib/payments/plans"

interface SubscriptionButtonProps {
  buttonText: string
  plan: Plan
  activeSub?: {
    id: string
    status: string
    seats?: number
    cancelAtPeriodEnd?: boolean
    [key: string]: unknown
  }
  subId?: string
}

export default function SubscriptionButton({
  buttonText,
  plan,
  activeSub,
  subId,
}: SubscriptionButtonProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  const handleSubscription = async () => {
    try {
      setIsPending(true)

      if (activeSub && subId) {
        // Update existing subscription
        const loadingToast = toast.loading("Updating subscription...")

        const result = await updateExistingSubscription(subId, plan.priceId)
        // Subscription updated successfully

        toast.dismiss(loadingToast)

        if (result.status) {
          toast.success(result.message || "Subscription updated successfully")
          setTimeout(() => {
            router.refresh()
          }, 3000)
        } else {
          toast.error(result.message || "Failed to update subscription")
        }
      } else {
        // Create new subscription
        // TODO: Implement subscription creation with your payment provider
        const response = await fetch("/api/billing/create-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            planId: plan.priceId,
            successUrl: "/dashboard/billing",
            cancelUrl: "/dashboard/billing",
          }),
        })

        if (!response.ok) {
          toast.error("Failed to create subscription")
        } else {
          const result = await response.json()
          if (result.url && typeof window !== "undefined") {
            window.location.href = result.url
          }
        }
      }
    } catch (_err) {
      // Handle error silently
      toast.error("An unexpected error occurred")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button type="button" onClick={handleSubscription} disabled={isPending}>
      {isPending ? "Processing..." : buttonText}
    </Button>
  )
}
