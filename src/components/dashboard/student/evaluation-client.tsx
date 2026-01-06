"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { MessageSquare, Building2, ChevronRight } from "lucide-react"
import { safeFetchApi } from "@/lib/safe-fetch"
import { DashboardBackground } from "@/components/dashboard/dashboard-background"
import { motion, AnimatePresence } from "framer-motion"
import { SiteEvaluationForm } from "@/components/evaluations/site-evaluation-form"

interface Rotation {
  id: string
  clinicalSiteId: string
  clinicalSiteName: string
  preceptorId: string | null
  preceptorName: string | null
  startDate: string
  endDate: string
}

export default function StudentEvaluationClient({
  userId,
  rotationId,
}: {
  userId: string
  rotationId?: string
}) {
  const [rotations, setRotations] = useState<Rotation[]>([])
  const [selectedRotation, setSelectedRotation] = useState<Rotation | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchRotations()
  }, [])

  const fetchRotations = async () => {
    setIsLoading(true)
    try {
      const res = await safeFetchApi("/api/rotations")
      if (res.success) {
        const fetchedRotations = res.data as Rotation[]
        setRotations(fetchedRotations)

        // If rotationId is provided, auto-select it
        if (rotationId) {
          const rotation = fetchedRotations.find((r) => r.id === rotationId)
          if (rotation) {
            setSelectedRotation(rotation)
          }
        }
      }
    } catch (error) {
      toast.error("Failed to load rotations")
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="relative min-h-[400px] flex items-center justify-center">
        <DashboardBackground />
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full pb-20">
      <DashboardBackground />

      <div className="relative z-10 max-w-3xl mx-auto space-y-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <MessageSquare className="h-6 w-6" />
            <h1 className="text-3xl font-bold tracking-tight">Site Evaluation</h1>
          </div>
          <p className="text-muted-foreground">
            Share your experience at your clinical site and with your preceptor.
          </p>
        </header>

        <AnimatePresence mode="wait">
          {!selectedRotation ? (
            <motion.div
              key="selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
                <CardHeader>
                  <CardTitle>Select Rotation</CardTitle>
                  <CardDescription>Which clinical rotation are you evaluating?</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {rotations.length > 0 ? (
                    rotations.map((rotation) => (
                      <button
                        key={rotation.id}
                        onClick={() => setSelectedRotation(rotation)}
                        className="flex items-center justify-between p-4 rounded-xl bg-background/50 border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-semibold group-hover:text-primary transition-colors">
                              {rotation.clinicalSiteName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {rotation.preceptorName
                                ? `Preceptor: ${rotation.preceptorName}`
                                : "No preceptor assigned"}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No rotations found to evaluate.
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <SiteEvaluationForm
                rotationId={selectedRotation.id}
                clinicalSiteId={selectedRotation.clinicalSiteId}
                clinicalSiteName={selectedRotation.clinicalSiteName}
                preceptorId={selectedRotation.preceptorId || undefined}
                onSuccess={() => (window.location.href = "/dashboard/student/rotations")}
              />
              <div className="mt-4 flex justify-center">
                <button
                  onClick={() => setSelectedRotation(null)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  ← Back to rotation selection
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
