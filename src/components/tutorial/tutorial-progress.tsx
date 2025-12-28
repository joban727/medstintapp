"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Award, BookOpen, CheckCircle, Clock, Target, Trophy, Zap } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { cn } from "../../lib/utils"
import type { UserRole } from "../../types"
import { Badge } from "../ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"

export interface TutorialBadge {
  id: string
  name: string
  description: string
  icon: string
  color: string
  rarity: "common" | "rare" | "epic" | "legendary"
  requirements: {
    tutorialsCompleted?: string[]
    totalTutorials?: number
    timeLimit?: number // in minutes
    perfectScore?: boolean
  }
  unlockedAt?: Date
}

export interface TutorialProgress {
  tutorialId: string
  userId: string
  startedAt: Date
  completedAt?: Date
  currentStep: number
  totalSteps: number
  completedSteps: string[]
  skippedSteps: string[]
  timeSpent: number // in seconds
  score?: number
  badges: string[]
  lastAccessedAt: Date
}

export interface TutorialStats {
  totalTutorials: number
  completedTutorials: number
  totalTimeSpent: number
  averageScore: number
  streakDays: number
  lastCompletedAt?: Date
  badges: TutorialBadge[]
  achievements: {
    fastLearner: boolean // completed tutorial in under expected time
    perfectionist: boolean // completed all steps without skipping
    explorer: boolean // completed tutorials from all categories
    dedicated: boolean // 7-day streak
  }
}

export interface TutorialProgressProps {
  userId: string
  userRole: UserRole
  onBadgeEarned?: (badge: TutorialBadge) => void
  onMilestoneReached?: (milestone: string) => void
  className?: string
}

// Default badges configuration
const DEFAULT_BADGES: TutorialBadge[] = [
  {
    id: "first-steps",
    name: "First Steps",
    description: "Complete your first tutorial",
    icon: "👶",
    color: "bg-blue-500",
    rarity: "common",
    requirements: {
      totalTutorials: 1,
    },
  },
  {
    id: "quick-learner",
    name: "Quick Learner",
    description: "Complete a tutorial in under 5 minutes",
    icon: "⚡",
    color: "bg-warning",
    rarity: "rare",
    requirements: {
      timeLimit: 5,
    },
  },
  {
    id: "perfectionist",
    name: "Perfectionist",
    description: "Complete a tutorial without skipping any steps",
    icon: "💎",
    color: "bg-purple-500",
    rarity: "epic",
    requirements: {
      perfectScore: true,
    },
  },
  {
    id: "onboarding-master",
    name: "Onboarding Master",
    description: "Complete all onboarding tutorials",
    icon: "🎓",
    color: "bg-green-500",
    rarity: "epic",
    requirements: {
      tutorialsCompleted: ["user-type", "school-profile", "programs", "rotations"],
    },
  },
  {
    id: "tutorial-champion",
    name: "Tutorial Champion",
    description: "Complete 10 tutorials",
    icon: "🏆",
    color: "bg-gold-500",
    rarity: "legendary",
    requirements: {
      totalTutorials: 10,
    },
  },
  {
    id: "speed-demon",
    name: "Speed Demon",
    description: "Complete 3 tutorials in under 2 minutes each",
    icon: "🔥",
    color: "bg-red-500",
    rarity: "legendary",
    requirements: {
      timeLimit: 2,
      totalTutorials: 3,
    },
  },
]

export function TutorialProgress({
  userId,
  userRole,
  onBadgeEarned,
  onMilestoneReached,
  className,
}: TutorialProgressProps) {
  const [progress, setProgress] = useState<TutorialProgress[]>([])
  const [stats, setStats] = useState<TutorialStats>({
    totalTutorials: 0,
    completedTutorials: 0,
    totalTimeSpent: 0,
    averageScore: 0,
    streakDays: 0,
    badges: [],
    achievements: {
      fastLearner: false,
      perfectionist: false,
      explorer: false,
      dedicated: false,
    },
  })
  const [recentBadges, setRecentBadges] = useState<TutorialBadge[]>([])
  const [showBadgeAnimation, setShowBadgeAnimation] = useState(false)

  // Load progress from localStorage
  const loadProgress = useCallback(() => {
    try {
      const savedProgress = localStorage.getItem(`tutorial-progress-${userId}`)
      if (savedProgress) {
        let parsed = null
        try {
          parsed = JSON.parse(savedProgress)
        } catch (error) {
          console.error("Failed to parse tutorial progress:", error)
          return {}
        }
        setProgress(
          parsed.map((p: any) => ({
            ...p,
            startedAt: new Date(p.startedAt),
            completedAt: p.completedAt ? new Date(p.completedAt) : undefined,
            lastAccessedAt: new Date(p.lastAccessedAt),
          }))
        )
      }
    } catch (error) {
      console.error("Failed to load tutorial progress:", error)
    }
  }, [userId])

  // Save progress to localStorage
  const saveProgress = useCallback(
    (newProgress: TutorialProgress[]) => {
      try {
        try {
          localStorage.setItem(`tutorial-progress-${userId}`, JSON.stringify(newProgress))
        } catch (error) {
          console.error("Failed to save tutorial progress:", error)
        }
      } catch (error) {
        console.error("Failed to save tutorial progress:", error)
      }
    },
    [userId]
  )

  // Calculate stats from progress
  const calculateStats = useCallback(
    (progressData: TutorialProgress[]) => {
      const completed = progressData.filter((p) => p.completedAt)
      const totalTime = progressData.reduce((sum, p) => sum + p.timeSpent, 0)
      const totalScore = completed.reduce((sum, p) => sum + (p.score || 0), 0)

      // Calculate streak
      const sortedCompleted = completed.sort(
        (a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
      )
      let streakDays = 0
      let currentDate = new Date()
      currentDate.setHours(0, 0, 0, 0)

      for (const tutorial of sortedCompleted) {
        if (!tutorial.completedAt) continue
        const completedDate = new Date(tutorial.completedAt)
        completedDate.setHours(0, 0, 0, 0)

        const daysDiff = Math.floor(
          (currentDate.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysDiff === streakDays) {
          streakDays++
          currentDate = new Date(completedDate)
        } else {
          break
        }
      }

      // Check achievements
      const achievements = {
        fastLearner: completed.some((p) => p.timeSpent < 300), // under 5 minutes
        perfectionist: completed.some((p) => p.skippedSteps.length === 0),
        explorer: new Set(completed.map((p) => p.tutorialId.split("-")[0])).size >= 3,
        dedicated: streakDays >= 7,
      }

      // Check for new badges
      const earnedBadges: TutorialBadge[] = []
      for (const badge of DEFAULT_BADGES) {
        const alreadyEarned = stats.badges.some((b) => b.id === badge.id)
        if (alreadyEarned) continue

        let shouldEarn = false

        if (
          badge.requirements.totalTutorials &&
          completed.length >= badge.requirements.totalTutorials
        ) {
          shouldEarn = true
        }

        if (badge.requirements.tutorialsCompleted) {
          const requiredTutorials = badge.requirements.tutorialsCompleted
          const completedIds = completed.map((p) => p.tutorialId)
          shouldEarn = requiredTutorials.every((id) => completedIds.includes(id))
        }

        if (badge.requirements.timeLimit) {
          const limitSeconds = (badge.requirements.timeLimit ?? 0) * 60
          const fastCompletions = completed.filter((p) => p.timeSpent <= limitSeconds)
          if (badge.requirements.totalTutorials) {
            shouldEarn = fastCompletions.length >= badge.requirements.totalTutorials
          } else {
            shouldEarn = fastCompletions.length > 0
          }
        }

        if (badge.requirements.perfectScore) {
          shouldEarn = completed.some((p) => p.skippedSteps.length === 0)
        }

        if (shouldEarn) {
          earnedBadges.push({ ...badge, unlockedAt: new Date() })
        }
      }

      // Trigger badge earned callbacks
      if (earnedBadges.length > 0) {
        setRecentBadges(earnedBadges)
        setShowBadgeAnimation(true)
        earnedBadges.forEach((badge) => onBadgeEarned?.(badge))
        setTimeout(() => setShowBadgeAnimation(false), 3000)
      }

      const newStats: TutorialStats = {
        totalTutorials: progressData.length,
        completedTutorials: completed.length,
        totalTimeSpent: totalTime,
        averageScore: completed.length > 0 ? totalScore / completed.length : 0,
        streakDays,
        lastCompletedAt: completed[0]?.completedAt,
        badges: [...stats.badges, ...earnedBadges],
        achievements,
      }

      setStats(newStats)
      return newStats
    },
    [stats.badges, onBadgeEarned]
  )

  // Update tutorial progress
  const updateTutorialProgress = useCallback(
    (tutorialId: string, updates: Partial<TutorialProgress>) => {
      setProgress((prev) => {
        const existing = prev.find((p) => p.tutorialId === tutorialId)
        let newProgress: TutorialProgress[]

        if (existing) {
          newProgress = prev.map((p) =>
            p.tutorialId === tutorialId ? { ...p, ...updates, lastAccessedAt: new Date() } : p
          )
        } else {
          const newTutorial: TutorialProgress = {
            tutorialId,
            userId,
            startedAt: new Date(),
            currentStep: 0,
            totalSteps: 1,
            completedSteps: [],
            skippedSteps: [],
            timeSpent: 0,
            badges: [],
            lastAccessedAt: new Date(),
            ...updates,
          }
          newProgress = [...prev, newTutorial]
        }

        saveProgress(newProgress)
        calculateStats(newProgress)
        return newProgress
      })
    },
    [userId, saveProgress, calculateStats]
  )

  // Mark tutorial as completed
  const _completeTutorial = useCallback(
    (tutorialId: string, score?: number) => {
      updateTutorialProgress(tutorialId, {
        completedAt: new Date(),
        currentStep: -1, // Mark as completed
        score,
      })
      onMilestoneReached?.(`tutorial-completed-${tutorialId}`)
    },
    [updateTutorialProgress, onMilestoneReached]
  )

  // Get tutorial progress by ID
  const _getTutorialProgress = useCallback(
    (tutorialId: string) => {
      return progress.find((p) => p.tutorialId === tutorialId)
    },
    [progress]
  )

  // Load initial data
  useEffect(() => {
    loadProgress()
  }, [loadProgress])

  // Recalculate stats when progress changes
  useEffect(() => {
    if (progress.length > 0) {
      calculateStats(progress)
    }
  }, [progress, calculateStats])

  const completionRate =
    stats.totalTutorials > 0 ? (stats.completedTutorials / stats.totalTutorials) * 100 : 0
  const formattedTime = Math.floor(stats.totalTimeSpent / 60)

  return (
    <div className={cn("gap-6", className)}>
      {/* Badge Animation */}
      <AnimatePresence>
        {showBadgeAnimation && recentBadges.length > 0 && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="mx-4 max-w-md rounded-xl bg-white p-8 text-center shadow-2xl"
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 50 }}
              transition={{ type: "spring", duration: 0.6 }}
            >
              <motion.div
                className="mb-4 text-6xl"
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {recentBadges[0].icon}
              </motion.div>
              <h3 className="mb-2 font-bold text-2xl text-gray-900">Badge Earned!</h3>
              <h4 className="mb-2 font-semibold text-medical-primary text-lg">
                {recentBadges[0].name}
              </h4>
              <p className="mb-4 text-gray-600">{recentBadges[0].description}</p>
              <Badge variant="secondary" className={cn("text-white", recentBadges[0].color)}>
                {recentBadges[0].rarity}
              </Badge>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <BookOpen className="h-5 w-5 text-medical-primary" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Completed</p>
                <p className="font-bold text-2xl">
                  {stats.completedTutorials}/{stats.totalTutorials}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <Target className="h-5 w-5 text-healthcare-green" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Completion Rate</p>
                <p className="font-bold text-2xl">{Math.round(completionRate)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Time Spent</p>
                <p className="font-bold text-2xl">{formattedTime}m</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-100 p-2">
                <Zap className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-gray-600 text-sm">Streak</p>
                <p className="font-bold text-2xl">{stats.streakDays} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {stats.totalTutorials > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Overall Progress</h3>
                <span className="text-gray-600 text-sm">
                  {stats.completedTutorials} of {stats.totalTutorials} completed
                </span>
              </div>
              <Progress value={completionRate} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Badges */}
      {stats.badges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-600" />
              Badges Earned ({stats.badges.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {stats.badges.map((badge) => (
                <motion.div
                  key={badge.id}
                  className="rounded-lg border-2 border-gray-200 p-4 text-center transition-colors duration-200 hover:border-blue-300"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="mb-2 text-3xl">{badge.icon}</div>
                  <h4 className="mb-1 font-semibold text-sm">{badge.name}</h4>
                  <p className="mb-2 text-gray-600 text-xs">{badge.description}</p>
                  <Badge variant="secondary" className={cn("text-white text-xs", badge.color)}>
                    {badge.rarity}
                  </Badge>
                  {badge.unlockedAt && (
                    <p className="mt-1 text-gray-500 text-xs">
                      {badge.unlockedAt.toLocaleDateString()}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-purple-600" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.entries(stats.achievements).map(([key, achieved]) => {
              const achievementConfig = {
                fastLearner: {
                  name: "Fast Learner",
                  icon: "⚡",
                  description: "Complete a tutorial quickly",
                },
                perfectionist: {
                  name: "Perfectionist",
                  icon: "💎",
                  description: "Complete without skipping",
                },
                explorer: {
                  name: "Explorer",
                  icon: "🗺️",
                  description: "Try different tutorial types",
                },
                dedicated: {
                  name: "Dedicated",
                  icon: "🔥",
                  description: "Maintain a 7-day streak",
                },
              }[key]

              return (
                <div
                  key={key}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-2 p-3 transition-colors duration-200",
                    achieved ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"
                  )}
                >
                  <div className={cn("text-2xl", achieved ? "" : "opacity-50 grayscale")}>
                    {achievementConfig?.icon}
                  </div>
                  <div className="flex-1">
                    <h4
                      className={cn("font-semibold", achieved ? "text-green-900" : "text-gray-600")}
                    >
                      {achievementConfig?.name}
                    </h4>
                    <p className={cn("text-sm", achieved ? "text-green-700" : "text-gray-500")}>
                      {achievementConfig?.description}
                    </p>
                  </div>
                  {achieved && <CheckCircle className="h-5 w-5 text-healthcare-green" />}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Hook for using tutorial progress
export function useTutorialProgress(userId: string, userRole: UserRole) {
  const [progressComponent, setProgressComponent] = useState<any>(null)

  useEffect(() => {
    setProgressComponent(
      <TutorialProgress
        userId={userId}
        userRole={userRole}
        onBadgeEarned={(badge) => {
          console.log("Badge earned:", badge)
          // You can add toast notifications here
        }}
        onMilestoneReached={(milestone) => {
          console.log("Milestone reached:", milestone)
          // You can add analytics tracking here
        }}
      />
    )
  }, [userId, userRole])

  return {
    ProgressComponent: progressComponent,
    updateProgress: (tutorialId: string, updates: Partial<TutorialProgress>) => {
      // This would be implemented to update the progress
      console.log("Update progress:", tutorialId, updates)
    },
    completeProgress: (tutorialId: string, score?: number) => {
      // This would be implemented to complete the tutorial
      console.log("Complete tutorial:", tutorialId, score)
    },
  }
}
