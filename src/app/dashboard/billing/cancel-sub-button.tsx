"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "../../../components/ui/button"
import { cancelSubscription } from "../../../lib/payments/actions"

export default function CancelSubscription() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function handleSubCancellation() {
    try {
      setIsPending(true)
      const loadingToast = toast.loading("Canceling subscription...")

      const result = await cancelSubscription()

      if (!result.status) {
        throw new Error(result.message)
      }

      toast.dismiss(loadingToast)
      toast.success("Subscription canceled successfully")

      setTimeout(() => {
        router.refresh()
      }, 3000)
    } catch (_error) {
      // Handle cancellation error silently
      toast.error("Failed to cancel subscription")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button variant="destructive" onClick={handleSubCancellation} disabled={isPending}>
      {isPending ? "Processing..." : "Cancel subscription"}
    </Button>
  )
}
