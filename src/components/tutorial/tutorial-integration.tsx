"use client"

import { AnimatePresence, motion } from "framer-motion"
import { Award, HelpCircle, Pause, Play, RotateCcw, Settings, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useHotkeys } from "react-hotkeys-hook"
import { cn } from "../../lib/utils"
import type { UserRole } from "../../types"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Card, CardContent } from "../ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog"
import { Slider } from "../ui/slider"
import { Switch } from "../ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import { GuidedWalkthrough, type WalkthroughConfig } from "./guided-walkthrough"
import { TooltipWrapper } from "./interactive-tooltip"
import { TutorialOverlay } from "./tutorial-overlay"
import { TutorialProgress } from "./tutorial-progress"

export interface TutorialSettings {
  enabled: boolean
  autoStart: boolean
  showHints: boolean
  playSound: boolean
  animationSpeed: number
  highContrast: boolean
  reducedMotion: boolean
  fontSize: "small" | "medium" | "large"
  voiceOver: boolean
  keyboardNavigation: boolean
}

export interface TutorialState {
  isActive: boolean
  currentTutorial: string | null
  currentStep: number
  isPaused: boolean
  showProgress: boolean
  showSettings: boolean
  completedTutorials: string[]
  skippedTutorials: string[]
  userPreferences: TutorialSettings
}

export interface TutorialIntegrationProps {
  userRole: UserRole
  userId?: string
  onboardingStep?: string
  className?: string
  children?: React.ReactNode
  onClose?: () => void
}

const DEFAULT_SETTINGS: TutorialSettings = {
  enabled: true,
  autoStart: false, // Changed to false to prevent automatic blur overlay
  showHints: true,
  playSound: false,
  animationSpeed: 1,
  highContrast: false,
  reducedMotion: false,
  fontSize: "medium",
  voiceOver: false,
  keyboardNavigation: true,
}

const TUTORIAL_CONFIGS: Record<string, WalkthroughConfig> = {
  welcome: {
    id: "welcome",
    title: "Welcome to MedStintClerk",
    description: "Get started with your onboarding journey",
    steps: [
      {
        id: "welcome-intro",
        title: "Welcome to MedStintClerk!",
        text: "Welcome! This tutorial will guide you through setting up your school administration system. Let's start by exploring what you can do here.",
        attachTo: {
          element: '[data-tutorial="welcome-header"]',
          on: "bottom",
        },
        buttons: [{ text: "Get Started", action: "next" }],
      },
      {
        id: "progress-tracker",
        title: "Track Your Progress",
        text: "This progress bar shows how far you are in the onboarding process. You're currently on step 1 of 6.",
        attachTo: {
          element: '[data-tutorial="progress-tracker"]',
          on: "bottom",
        },
        buttons: [
          { text: "Previous", action: "back" },
          { text: "Continue", action: "next" },
        ],
      },
      {
        id: "quick-start-guide",
        title: "Quick Start Guide",
        text: "This section gives you an overview of what to expect during onboarding. Each step is designed to be quick and easy.",
        attachTo: {
          element: '[data-tutorial="quick-start-guide"]',
          on: "right",
        },
        buttons: [
          { text: "Previous", action: "back" },
          { text: "Continue", action: "next" },
        ],
      },
      {
        id: "onboarding-steps",
        title: "Your Onboarding Journey",
        text: "Here you can see all the steps you'll complete. Each step builds on the previous one to get your system fully configured.",
        attachTo: {
          element: '[data-tutorial="onboarding-steps"]',
          on: "left",
        },
        buttons: [
          { text: "Previous", action: "back" },
          { text: "Continue", action: "next" },
        ],
      },
      {
        id: "system-overview",
        title: "What You'll Get",
        text: "This section shows you all the powerful features you'll have access to once setup is complete.",
        attachTo: {
          element: '[data-tutorial="system-overview"]',
          on: "top",
        },
        buttons: [
          { text: "Previous", action: "back" },
          { text: "Continue", action: "next" },
        ],
      },
      {
        id: "continue-button",
        title: "Ready to Begin?",
        text: "When you're ready, click this button to start your school profile setup. Don't worry - you can always come back and modify anything later!",
        attachTo: {
          element: '[data-tutorial="continue-btn"]',
          on: "top",
        },
        buttons: [
          { text: "Previous", action: "back" },
          { text: "Start Setup!", action: "complete" },
        ],
      },
    ],
  },
  "user-type-selection": {
    id: "user-type-selection",
    title: "Choose Your Account Type",
    description: "Select the role that best describes you",
    steps: [
      {
        id: "welcome",
        title: "Welcome to MedStintClerk",
        text: "Let's get you started by selecting your account type. This will customize your experience.",
        attachTo: {
          element: '[data-tutorial="user-type"]',
          on: "bottom",
        },
        buttons: [
          { text: "Skip Tour", action: "skip", classes: "btn-secondary" },
          { text: "Get Started", action: "next", classes: "btn-primary" },
        ],
      },
      {
        id: "role-selection",
        title: "Select Your Role",
        text: "Choose the option that matches your position in medical education. This helps us provide relevant features.",
        attachTo: {
          element: '[data-tutorial="role-options"]',
          on: "top",
        },
        buttons: [
          { text: "Previous", action: "back" },
          { text: "Continue", action: "next" },
        ],
      },
      {
        id: "confirmation",
        title: "Perfect!",
        text: "Your account type has been set. You can always change this later in your profile settings.",
        attachTo: {
          element: '[data-tutorial="continue-btn"]',
          on: "top",
        },
        buttons: [{ text: "Finish", action: "complete" }],
      },
    ],
  },
  "school-profile-setup": {
    id: "school-profile-setup",
    title: "Set Up Your School Profile",
    description: "Add your institution information",
    steps: [
      {
        id: "school-info",
        title: "School Information",
        text: "Enter your school's basic information. This helps students find and connect with your institution.",
        attachTo: {
          element: '[data-tutorial="school-form"]',
          on: "right",
        },
      },
      {
        id: "contact-details",
        title: "Contact Information",
        text: "Add contact details so students and other institutions can reach you.",
        attachTo: {
          element: '[data-tutorial="contact-form"]',
          on: "left",
        },
      },
      {
        id: "programs",
        title: "Programs & Rotations",
        text: "Set up your medical programs and rotation opportunities.",
        attachTo: {
          element: '[data-tutorial="programs-section"]',
          on: "bottom",
        },
      },
    ],
  },
  "student-profile-setup": {
    id: "student-profile-setup",
    title: "Complete Your Student Profile",
    description: "Set up your academic information",
    steps: [
      {
        id: "personal-info",
        title: "Personal Information",
        text: "Complete your profile with academic and personal details.",
        attachTo: {
          element: '[data-tutorial="student-form"]',
          on: "right",
        },
      },
      {
        id: "preferences",
        title: "Rotation Preferences",
        text: "Set your preferences for clinical rotations and specialties.",
        attachTo: {
          element: '[data-tutorial="preferences-form"]',
          on: "left",
        },
      },
    ],
  },
  "school-admin-dashboard": {
    id: "school-admin-dashboard",
    title: "Getting Started Guide",
    description: "Learn how to navigate and set up your school dashboard.",
    estimatedDuration: 3,
    category: "onboarding",
    steps: [
      {
        id: "sidebar-intro",
        title: "Welcome to MedStintClerk!",
        text: "Let's get you started! Use the sidebar on the left to navigate between different sections of your dashboard. Each menu item takes you to a specific management area.",
        attachTo: {
          element: '[data-tutorial="sidebar-nav"]',
          on: "right",
        },
        buttons: [
          { text: "Skip Tour", action: "skip", classes: "shepherd-button-secondary" },
          { text: "Next", action: "next" },
        ],
      },
      {
        id: "students-page",
        title: "Step 1: Add Students",
        text: "Click 'Students' in the sidebar to add and manage your enrolled students. You can add students individually or import them in bulk from a CSV file.",
        attachTo: {
          element: '[data-tutorial="sidebar-nav"]',
          on: "right",
        },
        buttons: [
          { text: "Back", action: "back" },
          { text: "Next", action: "next" },
        ],
      },
      {
        id: "programs-page",
        title: "Step 2: Set Up Programs",
        text: "Click 'Programs' to create your medical education programs and define their requirements, rotations, and competencies.",
        attachTo: {
          element: '[data-tutorial="sidebar-nav"]',
          on: "right",
        },
        buttons: [
          { text: "Back", action: "back" },
          { text: "Next", action: "next" },
        ],
      },
      {
        id: "sites-page",
        title: "Step 3: Add Clinical Sites",
        text: "Click 'Clinical Sites' to add hospitals, clinics, and other facilities where students will complete their rotations.",
        attachTo: {
          element: '[data-tutorial="sidebar-nav"]',
          on: "right",
        },
        buttons: [
          { text: "Back", action: "back" },
          { text: "Next", action: "next" },
        ],
      },
      {
        id: "rotations-page",
        title: "Step 4: Schedule Rotations",
        text: "Click 'Rotations' to assign students to clinical sites and manage their rotation schedules.",
        attachTo: {
          element: '[data-tutorial="sidebar-nav"]',
          on: "right",
        },
        buttons: [
          { text: "Back", action: "back" },
          { text: "Got It!", action: "complete" },
        ],
      },
    ],
  },
}

export function TutorialIntegration({
  userRole,
  userId,
  onboardingStep,
  className,
  children,
  onClose,
}: TutorialIntegrationProps) {
  const [state, setState] = useState<TutorialState>({
    isActive: false,
    currentTutorial: null,
    currentStep: 0,
    isPaused: false,
    showProgress: true,
    showSettings: false,
    completedTutorials: [],
    skippedTutorials: [],
    userPreferences: DEFAULT_SETTINGS,
  })

  const tutorialRef = useRef<any>(null)

  // Load user preferences and tutorial state
  useEffect(() => {
    const loadTutorialState = async () => {
      try {
        const savedState = localStorage.getItem(`tutorial-state-${userId}`)
        if (savedState) {
          const parsed = JSON.parse(savedState)
          setState((prev) => ({
            ...prev,
            completedTutorials: parsed.completedTutorials || [],
            skippedTutorials: parsed.skippedTutorials || [],
            userPreferences: { ...DEFAULT_SETTINGS, ...parsed.userPreferences },
          }))
        }
      } catch (error) {
        console.error("Failed to load tutorial state:", error)
      }
    }

    if (userId) {
      loadTutorialState()
    }
  }, [userId])

  // Auto-start tutorial based on onboarding step
  useEffect(() => {
    if (
      state.userPreferences.enabled &&
      state.userPreferences.autoStart &&
      onboardingStep &&
      !state.completedTutorials.includes(onboardingStep) &&
      !state.skippedTutorials.includes(onboardingStep)
    ) {
      startTutorial(onboardingStep)
    }
  }, [onboardingStep, state.userPreferences, state.completedTutorials, state.skippedTutorials])

  // Save tutorial state
  const saveTutorialState = useCallback(() => {
    if (userId) {
      const stateToSave = {
        completedTutorials: state.completedTutorials,
        skippedTutorials: state.skippedTutorials,
        userPreferences: state.userPreferences,
      }
      localStorage.setItem(`tutorial-state-${userId}`, JSON.stringify(stateToSave))
    }
  }, [userId, state.completedTutorials, state.skippedTutorials, state.userPreferences])

  // Save state when it changes
  useEffect(() => {
    saveTutorialState()
  }, [saveTutorialState])

  const startTutorial = useCallback((tutorialId: string) => {
    const config = TUTORIAL_CONFIGS[tutorialId]
    if (!config) return

    setState((prev) => ({
      ...prev,
      isActive: true,
      currentTutorial: tutorialId,
      currentStep: 0,
      isPaused: false,
    }))
  }, [])

  const stopTutorial = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      currentTutorial: null,
      currentStep: 0,
      isPaused: false,
    }))
    onClose?.()
  }, [onClose])

  const completeTutorial = useCallback((tutorialId: string) => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      currentTutorial: null,
      currentStep: 0,
      isPaused: false,
      completedTutorials: [...prev.completedTutorials, tutorialId],
    }))
    onClose?.()
  }, [onClose])

  const skipTutorial = useCallback((tutorialId: string) => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      currentTutorial: null,
      currentStep: 0,
      isPaused: false,
      skippedTutorials: [...prev.skippedTutorials, tutorialId],
    }))
    onClose?.()
  }, [onClose])

  const pauseTutorial = useCallback(() => {
    setState((prev) => ({ ...prev, isPaused: !prev.isPaused }))
  }, [])

  const restartTutorial = useCallback(() => {
    if (state.currentTutorial) {
      setState((prev) => ({ ...prev, currentStep: 0, isPaused: false }))
    }
  }, [state.currentTutorial])

  const updateSettings = useCallback((newSettings: Partial<TutorialSettings>) => {
    setState((prev) => ({
      ...prev,
      userPreferences: { ...prev.userPreferences, ...newSettings },
    }))
  }, [])

  const toggleSettings = useCallback(() => {
    setState((prev) => ({ ...prev, showSettings: !prev.showSettings }))
  }, [])

  // Keyboard shortcuts
  useHotkeys(
    "esc",
    () => {
      if (state.isActive) {
        stopTutorial()
      }
    },
    { enabled: state.userPreferences.keyboardNavigation }
  )

  useHotkeys(
    "space",
    (e) => {
      e.preventDefault()
      if (state.isActive) {
        pauseTutorial()
      }
    },
    { enabled: state.userPreferences.keyboardNavigation }
  )

  useHotkeys(
    "r",
    () => {
      if (state.isActive) {
        restartTutorial()
      }
    },
    { enabled: state.userPreferences.keyboardNavigation }
  )

  const currentConfig = state.currentTutorial ? TUTORIAL_CONFIGS[state.currentTutorial] : null

  return (
    <div className={cn("tutorial-integration", className)}>
      {children}

      {/* Tutorial Controls */}
      {state.isActive && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={pauseTutorial}
                  className="h-10 w-10 p-0"
                >
                  {state.isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {state.isPaused ? "Resume Tutorial" : "Pause Tutorial"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={restartTutorial}
                  className="h-10 w-10 p-0"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restart Tutorial</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleSettings}
                  className="h-10 w-10 p-0"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tutorial Settings</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={stopTutorial}
                  className="h-10 w-10 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exit Tutorial</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Tutorial Progress - Removed as GuidedWalkthrough handles it */}

      {/* Guided Walkthrough */}
      {state.isActive && currentConfig && !state.isPaused && (
        <GuidedWalkthrough
          config={currentConfig}
          isActive={state.isActive}
          onStepChange={(stepIndex, stepId) => setState((prev) => ({ ...prev, currentStep: stepIndex }))}
          onComplete={() => {
            if (!state.currentTutorial) return
            completeTutorial(state.currentTutorial)
          }}
          onSkip={() => {
            if (!state.currentTutorial) return
            skipTutorial(state.currentTutorial)
          }}
          onCancel={stopTutorial}
        />
      )}

      {/* Tutorial Overlay - Removed as GuidedWalkthrough handles UI */}

      {/* Settings Dialog */}
      <Dialog open={state.showSettings} onOpenChange={toggleSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Tutorial Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Enable Tutorials</label>
                <Switch
                  checked={state.userPreferences.enabled}
                  onCheckedChange={(checked) => updateSettings({ enabled: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Auto-start Tutorials</label>
                <Switch
                  checked={state.userPreferences.autoStart}
                  onCheckedChange={(checked) => updateSettings({ autoStart: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Show Hints</label>
                <Switch
                  checked={state.userPreferences.showHints}
                  onCheckedChange={(checked) => updateSettings({ showHints: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Play Sounds</label>
                <Switch
                  checked={state.userPreferences.playSound}
                  onCheckedChange={(checked) => updateSettings({ playSound: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">High Contrast</label>
                <Switch
                  checked={state.userPreferences.highContrast}
                  onCheckedChange={(checked) => updateSettings({ highContrast: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Reduced Motion</label>
                <Switch
                  checked={state.userPreferences.reducedMotion}
                  onCheckedChange={(checked) => updateSettings({ reducedMotion: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Keyboard Navigation</label>
                <Switch
                  checked={state.userPreferences.keyboardNavigation}
                  onCheckedChange={(checked) => updateSettings({ keyboardNavigation: checked })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Animation Speed</label>
              <Slider
                value={[state.userPreferences.animationSpeed]}
                onValueChange={([value]) => updateSettings({ animationSpeed: value })}
                min={0.5}
                max={2}
                step={0.1}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground text-center">
                {state.userPreferences.animationSpeed}x
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Font Size</label>
              <div className="flex gap-2">
                {(["small", "medium", "large"] as const).map((size) => (
                  <Button
                    key={size}
                    size="sm"
                    variant={state.userPreferences.fontSize === size ? "default" : "outline"}
                    onClick={() => updateSettings({ fontSize: size })}
                    className="flex-1 capitalize"
                  >
                    {size}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={() => updateSettings(DEFAULT_SETTINGS)}>
              Reset to Defaults
            </Button>
            <Button onClick={toggleSettings}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tutorial Launcher */}
      {!state.isActive && state.userPreferences.enabled && (
        <div className="fixed bottom-4 left-4 z-40">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onboardingStep && startTutorial(onboardingStep)}
                  className="h-10 w-10 p-0"
                  disabled={!onboardingStep}
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Start Tutorial</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Completion Badge */}
      <AnimatePresence>
        {state.completedTutorials.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-4 right-4 z-40"
          >
            <Card className="p-3">
              <CardContent className="p-0">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-yellow-500" />
                  <Badge variant="secondary">
                    {state.completedTutorials.length} Tutorial
                    {state.completedTutorials.length !== 1 ? "s" : ""} Completed
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
