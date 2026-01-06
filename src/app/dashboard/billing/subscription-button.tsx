"use client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "../../../components/ui/button"
import { updateExistingSubscription, createSubscription } from "../../../lib/payments/actions"
import type { Plan } from "../../../lib/payments/plans-service"

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

        const result = await updateExistingSubscription(subId, plan.stripePriceId)
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
        const result = await createSubscription(
          plan.stripePriceId,
          `${window.location.origin}/dashboard/billing`,
          `${window.location.origin}/dashboard/billing`
        )

        if (result.status && result.url) {
          window.location.href = result.url
        } else {
          toast.error(result.message || "Failed to create subscription")
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
