"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "../../../components/ui/button"

export default function CancelSubscription() {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  async function handleSubCancellation() {
    try {
      setIsPending(true)
      const loadingToast = toast.loading("Canceling subscription...")

      // TODO: Implement subscription cancellation with your payment provider
      // This would typically involve calling your API endpoint
      await fetch("/api/billing/cancel-subscription", {
        method: "POST",
      })

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
