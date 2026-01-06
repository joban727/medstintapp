"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"
import {
  Building2,
  Star,
  Users,
  TrendingUp,
  MessageSquare,
  Search,
  Filter,
  Download,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react"
import { format } from "date-fns"
import { safeFetchApi } from "@/lib/safe-fetch"
import { DashboardBackground } from "@/components/dashboard/dashboard-background"
import { motion } from "framer-motion"

interface EvaluationWithDetails {
  evaluation: {
    id: string
    rating: number
    feedback: string
    createdAt: string
    recommendToOthers: boolean
    isAnonymous: boolean
  }
  site: {
    name: string
  }
  studentName: string | null
}

export default function AdminEvaluationClient({ userId }: { userId: string }) {
  const [evaluations, setEvaluations] = useState<EvaluationWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchEvaluations()
  }, [])

  const fetchEvaluations = async () => {
    setIsLoading(true)
    try {
      const res = await safeFetchApi("/api/evaluations/site")
      if (res.success) {
        setEvaluations(res.data as EvaluationWithDetails[])
      }
    } catch (error) {
      toast.error("Failed to load evaluations")
    } finally {
      setIsLoading(false)
    }
  }

  const calculateAverageRating = () => {
    if (evaluations.length === 0) return 0
    const sum = evaluations.reduce((acc, curr) => acc + curr.evaluation.rating, 0)
    return (sum / evaluations.length).toFixed(1)
  }

  const getRecommendationRate = () => {
    if (evaluations.length === 0) return 0
    const recommended = evaluations.filter((e) => e.evaluation.recommendToOthers).length
    return Math.round((recommended / evaluations.length) * 100)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        Loading evaluation dashboard...
      </div>
    )
  }

  return (
    <div className="relative min-h-screen w-full">
      <DashboardBackground />

      <div className="relative z-10 space-y-6 max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-primary">
              <Building2 className="h-6 w-6" />
              <h1 className="text-3xl font-bold tracking-tight">Site Evaluations</h1>
            </div>
            <p className="text-muted-foreground">
              Monitor clinical site quality and student satisfaction.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{calculateAverageRating()}</div>
                <Star className="h-5 w-5 fill-primary text-primary" />
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Average Rating
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{getRecommendationRate()}%</div>
                <ThumbsUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Recommendation Rate
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">{evaluations.length}</div>
                <MessageSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Total Evaluations
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold">12</div>
                <Building2 className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                Active Sites
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="recent" className="w-full">
          <TabsList className="bg-background/50 backdrop-blur-sm border border-border/50">
            <TabsTrigger value="recent" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Recent Feedback
            </TabsTrigger>
            <TabsTrigger value="sites" className="gap-2">
              <Building2 className="h-4 w-4" />
              Site Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="mt-6">
            <div className="grid gap-4">
              {evaluations.map((evalItem, index) => (
                <motion.div
                  key={evalItem.evaluation.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-card/40 backdrop-blur-sm border-primary/5">
                    <CardContent className="p-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                              {evalItem.evaluation.isAnonymous
                                ? "?"
                                : evalItem.studentName?.charAt(0) || "S"}
                            </div>
                            <div>
                              <div className="font-semibold">
                                {evalItem.evaluation.isAnonymous
                                  ? "Anonymous Student"
                                  : evalItem.studentName}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5" />
                                {evalItem.site.name}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`h-4 w-4 ${star <= evalItem.evaluation.rating ? "fill-primary text-primary" : "text-muted-foreground/20"}`}
                                />
                              ))}
                            </div>
                            <div className="text-[10px] text-muted-foreground uppercase">
                              {format(new Date(evalItem.evaluation.createdAt), "MMM d, yyyy")}
                            </div>
                          </div>
                        </div>

                        <div className="bg-background/30 p-4 rounded-xl border border-border/50 italic text-sm text-muted-foreground">
                          "{evalItem.evaluation.feedback || "No written feedback provided."}"
                        </div>

                        <div className="flex items-center gap-4">
                          <Badge
                            variant={
                              evalItem.evaluation.recommendToOthers ? "default" : "destructive"
                            }
                            className="gap-1"
                          >
                            {evalItem.evaluation.recommendToOthers ? (
                              <ThumbsUp className="h-3 w-3" />
                            ) : (
                              <ThumbsDown className="h-3 w-3" />
                            )}
                            {evalItem.evaluation.recommendToOthers
                              ? "Recommended"
                              : "Not Recommended"}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
              {evaluations.length === 0 && (
                <div className="text-center py-12 text-muted-foreground bg-card/20 rounded-xl border border-dashed border-border/50">
                  No evaluations submitted yet.
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sites" className="mt-6">
            <Card className="bg-card/40 backdrop-blur-sm border-primary/5">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-background/50">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Clinical Site</th>
                        <th className="px-6 py-3 font-semibold">Evaluations</th>
                        <th className="px-6 py-3 font-semibold">Avg. Rating</th>
                        <th className="px-6 py-3 font-semibold">Rec. Rate</th>
                        <th className="px-6 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {/* This would be aggregated in a real app */}
                      <tr className="hover:bg-background/30 transition-colors">
                        <td className="px-6 py-4 font-medium">General Hospital Central</td>
                        <td className="px-6 py-4">8</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                            4.8
                          </div>
                        </td>
                        <td className="px-6 py-4 text-emerald-500 font-semibold">100%</td>
                        <td className="px-6 py-4">
                          <Button variant="ghost" size="sm">
                            View Details
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
