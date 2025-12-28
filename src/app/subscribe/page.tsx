"use client"

import { useAuth } from "@clerk/nextjs"
import { motion } from "framer-motion"
import { Check, CreditCard, Lock, Shield, Sparkles, Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card"

const features = [
    { icon: Zap, text: "Full platform access" },
    { icon: Check, text: "Time clock & tracking" },
    { icon: Check, text: "Rotation management" },
    { icon: Check, text: "Competency tracking" },
    { icon: Check, text: "Mobile-friendly interface" },
]

export default function SubscribePage() {
    const router = useRouter()
    const { isSignedIn } = useAuth()
    const [isLoading, setIsLoading] = useState(false)

    const handleSubscribe = async () => {
        if (!isSignedIn) {
            router.push("/auth/sign-in?redirect_url=/subscribe")
            return
        }

        setIsLoading(true)

        try {
            const response = await fetch("/api/billing/create-student-checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    successUrl: `${window.location.origin}/subscribe/success`,
                    cancelUrl: `${window.location.origin}/subscribe`,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to create checkout session")
            }

            if (data.url) {
                // Redirect to Stripe Checkout
                window.location.href = data.url
            } else {
                throw new Error("No checkout URL returned")
            }
        } catch (error) {
            console.error("Subscription error:", error)
            toast.error(error instanceof Error ? error.message : "Failed to start subscription")
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-lg"
            >
                <Card className="border-2 border-primary/20 shadow-2xl overflow-hidden">
                    {/* Premium badge */}
                    <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground py-2 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            <span className="text-sm font-medium">Student Access Plan</span>
                            <Sparkles className="h-4 w-4" />
                        </div>
                    </div>

                    <CardHeader className="text-center pt-8 pb-4">
                        <CardTitle className="text-3xl font-bold">
                            Unlock Your Clinical Journey
                        </CardTitle>
                        <CardDescription className="text-lg mt-2">
                            Get full access to MedStint for your clinical rotations
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Price display */}
                        <div className="text-center py-6 bg-muted/50 rounded-xl">
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-5xl font-bold">$2</span>
                                <span className="text-muted-foreground">/month</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">
                                Cancel anytime • No hidden fees
                            </p>
                        </div>

                        {/* Features */}
                        <ul className="space-y-3">
                            {features.map((feature, index) => (
                                <motion.li
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.1 * index }}
                                    className="flex items-center gap-3"
                                >
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                                        <feature.icon className="h-4 w-4 text-primary" />
                                    </div>
                                    <span>{feature.text}</span>
                                </motion.li>
                            ))}
                        </ul>
                    </CardContent>

                    <CardFooter className="flex flex-col gap-4 pt-6 pb-8">
                        <Button
                            size="lg"
                            className="w-full h-14 text-lg font-semibold"
                            onClick={handleSubscribe}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    <span>Preparing checkout...</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    <span>Subscribe Now</span>
                                </div>
                            )}
                        </Button>

                        {/* Trust badges */}
                        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                <span>Secure payment</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                <span>256-bit encryption</span>
                            </div>
                        </div>
                    </CardFooter>
                </Card>

                {/* Sign out link */}
                <p className="text-center mt-6 text-sm text-muted-foreground">
                    Wrong account?{" "}
                    <a href="/auth/sign-out" className="text-primary hover:underline">
                        Sign out
                    </a>
                </p>
            </motion.div>
        </div>
    )
}
