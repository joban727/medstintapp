"use client"

import { motion } from "framer-motion"
import { AlertCircle, CreditCard, LogOut, RefreshCcw } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"

export default function SubscriptionRequiredPage() {
  const router = useRouter()

  const handleRefresh = () => {
    // Force refresh to re-check subscription status
    router.refresh()
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-2 border-border shadow-xl text-center">
          <CardHeader className="pt-10 pb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mx-auto mb-4"
            >
              <div className="h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto">
                <AlertCircle className="h-10 w-10 text-amber-600 dark:text-amber-400" />
              </div>
            </motion.div>

            <CardTitle className="text-2xl font-bold">Subscription Required</CardTitle>
            <CardDescription className="text-base mt-2">
              You need an active subscription to access the dashboard
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 pb-6">
            <div className="p-4 bg-muted/50 rounded-xl text-left space-y-2">
              <p className="text-sm">
                To use MedStint and track your clinical rotations, you&apos;ll need to subscribe to
                our student plan.
              </p>
              <div className="flex items-baseline gap-1 justify-center pt-2">
                <span className="text-3xl font-bold">$2</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pb-10">
            <Button asChild size="lg" className="w-full h-12 font-semibold">
              <Link href="/subscribe" className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Subscribe Now
              </Link>
            </Button>

            <div className="flex gap-2 w-full">
              <Button variant="outline" size="sm" className="flex-1" onClick={handleRefresh}>
                <RefreshCcw className="h-4 w-4 mr-1" />
                Refresh Status
              </Button>
              <Button asChild variant="ghost" size="sm" className="flex-1">
                <Link href="/auth/sign-out" className="flex items-center gap-1">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Link>
              </Button>
            </div>
          </CardFooter>
        </Card>

        <p className="text-center mt-6 text-sm text-muted-foreground">
          Need help?{" "}
          <a href="mailto:support@medstint.com" className="text-primary hover:underline">
            Contact support
          </a>
        </p>
      </motion.div>
    </div>
  )
}
