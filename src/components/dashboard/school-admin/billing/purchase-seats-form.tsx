"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { purchaseSeats } from "@/lib/payments/actions"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface PurchaseSeatsFormProps {
  schoolId: string
}

export function PurchaseSeatsForm({ schoolId }: PurchaseSeatsFormProps) {
  const [quantity, setQuantity] = useState(5)
  const [interval, setInterval] = useState<"month" | "year">("month")
  const [loading, setLoading] = useState(false)

  const handlePurchase = async () => {
    setLoading(true)
    try {
      const result = await purchaseSeats(
        schoolId,
        quantity,
        interval,
        window.location.href, // Success URL
        window.location.href // Cancel URL
      )

      if (result.status && result.url) {
        window.location.href = result.url
      } else {
        toast.error(result.message || "Failed to initiate purchase")
      }
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Billing Cycle</Label>
        <RadioGroup
          defaultValue="month"
          value={interval}
          onValueChange={(v) => setInterval(v as "month" | "year")}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="month" id="month" />
            <Label htmlFor="month">Monthly ($10/seat)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="year" id="year" />
            <Label htmlFor="year">Annual ($100/seat)</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="quantity">Number of Seats</Label>
        <Input
          id="quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
        />
      </div>

      <div className="pt-2">
        <div className="flex justify-between text-sm mb-4">
          <span>Total</span>
          <span className="font-bold">
            ${quantity * (interval === "month" ? 10 : 100)} / {interval}
          </span>
        </div>
        <Button className="w-full" onClick={handlePurchase} disabled={loading || quantity < 1}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Proceed to Checkout
        </Button>
      </div>
    </div>
  )
}
