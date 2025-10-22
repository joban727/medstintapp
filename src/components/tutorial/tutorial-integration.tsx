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
  children: React.ReactNode
}

const DEFAULT_SETTINGS: TutorialSettings = {
  enabled: true,
  autoStart: true,
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
    title: "Welcome to MedstintClerk",
    description: "Get started with your onboarding journey",
    steps: [
      {
        id: "welcome-intro",
        title: "Welcome to MedstintClerk!",
        text: "Welcome! This tutorial will guide you through setting up your school administration system. Let's start by exploring what you can do here.",
        attachTo: { element: '[data-tutorial="welcome-header"]', on: "bottom" },
        buttons: [{ text: "Get Started", action: "next" }],
      },
      {
        id: "progress-tracker",
        title: "Track Your Progress",
        text: "This progress bar shows how far you are in the onboarding process. You're currently on step 1 of 6.",
        attachTo: { element: '[data-tutorial="progress-tracker"]', on: "bottom" },
        buttons: [
          { text: "Previous", action: "back" },
          { text: "Continue", action: "next" },
        ],
      },
      {
        id: "quick-start-guide",
        title: "Quick Start Guide",
        text: "This section gives you an overview of what to expect during onboarding. Each step is designed to be quick and easy.",
        attachTo: { element: '[data-tutorial="quick-start-guide"]', on: "right" },
        buttons: [
          { text: "Previous", action: "back" },
          { text: "Continue", action: "next" },
        ],
      },
      {
        id: "onboarding-steps",
        title: "Your Onboarding Journey",
        text: "Here you can see all the steps you'll complete. Each step builds on the previous one to get your system fully configured.",
        attachTo: { element: '[data-tutorial="onboarding-steps"]', on: "left" },
        buttons: [
          { text: "Previous", action: "back" },
          { text: "Continue", action: "next" },
        ],
      },
      {
        id: "system-overview",
        title: "What You'll Get",
        text: "This section shows you all the powerful features you'll have access to once setup is complete.",
        attachTo: { element: '[data-tutorial="system-overview"]', on: "top" },
        buttons: [
          { text: "Previous", action: "back" },
          { text: "Continue", action: "next" },
        ],
      },
      {
        id: "continue-button",
        title: "Ready to Begin?",
        text: "When you're ready, click this button to start your school profile setup. Don't worry - you can always come back and modify anything later!",
        attachTo: { element: '[data-tutorial="continue-btn"]', on: "top" },
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
        title: "Welcome to MedstintClerk",
        text: "Let's get you started by selecting your account type. This will customize your experience.",
        attachTo: { element: '[data-tutorial="user-type"]', on: "bottom" },
        buttons: [
          { text: "Skip Tour", action: "skip", classes: "btn-secondary" },
          { text: "Get Started", action: "next", classes: "btn-primary" },
        ],
      },
      {
        id: "role-selection",
        title: "Select Your Role",
        text: "Choose the option that matches your position in medical education. This helps us provide relevant features.",
        attachTo: { element: '[data-tutorial="role-options"]', on: "top" },
        buttons: [
          { text: "Previous", action: "back" },
          { text: "Continue", action: "next" },
        ],
      },
      {
        id: "confirmation",
        title: "Perfect!",
        text: "Your account type has been set. You can always change this later in your profile settings.",
        attachTo: { element: '[data-tutorial="continue-btn"]', on: "top" },
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
        attachTo: { element: '[data-tutorial="school-form"]', on: "right" },
      },
      {
        id: "contact-details",
        title: "Contact Information",
        text: "Add contact details so students and other institutions can reach you.",
        attachTo: { element: '[data-tutorial="contact-form"]', on: "left" },
      },
      {
        id: "programs",
        title: "Programs & Rotations",
        text: "Set up your medical programs and rotation opportunities.",
        attachTo: { element: '[data-tutorial="programs-section"]', on: "bottom" },
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
        attachTo: { element: '[data-tutorial="student-form"]', on: "right" },
      },
      {
        id: "preferences",
        title: "Rotation Preferences",
        text: "Set your preferences for clinical rotations and specialties.",
        attachTo: { element: '[data-tutorial="preferences-form"]', on: "left" },
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
}: TutorialIntegrationProps) {
  const [tutorialState, setTutorialState] = useState<TutorialState>({
    isActive: false,
    currentTutorial: null,
    currentStep: 0,
    isPaused: false,
    showProgress: false,
    showSettings: false,
    completedTutorials: [],
    skippedTutorials: [],
    userPreferences: DEFAULT_SETTINGS,
  })

  const [showHelpButton, setShowHelpButton] = useState(true)
  const [tooltipElements, setTooltipElements] = useState<NodeListOf<Element> | null>(null)
  const _tutorialRef = useRef<any>(null)
  const _audioRef = useRef<HTMLAudioElement | null>(null)

  // Save tutorial state
  const saveTutorialState = useCallback(
    (newState: Partial<TutorialState>) => {
      const updatedState = { ...tutorialState, ...newState }
      setTutorialState(updatedState)

      try {
        localStorage.setItem(
          `tutorial-state-${userId || "anonymous"}`,
          JSON.stringify(updatedState)
        )
      } catch (error) {
        console.error("Failed to save tutorial state:", error)
      }
    },
    [tutorialState, userId]
  )

  // Play tutorial sounds
  const playTutorialSound = (type: "start" | "step" | "complete" | "cancel" | "error") => {
    if (!tutorialState.userPreferences.playSound) return

    // Create audio context for different sounds
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    const frequencies = {
      start: 440,
      step: 523,
      complete: 659,
      cancel: 330,
      error: 220,
    }

    oscillator.frequency.setValueAtTime(frequencies[type], audioContext.currentTime)
    oscillator.type = "sine"
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  }

  // Announce to screen readers
  const announceToScreenReader = (message: string) => {
    const announcement = document.createElement("div")
    announcement.setAttribute("aria-live", "polite")
    announcement.setAttribute("aria-atomic", "true")
    announcement.className = "sr-only"
    announcement.textContent = message

    document.body.appendChild(announcement)
    setTimeout(() => document.body.removeChild(announcement), 1000)
  }

  // Get tutorial ID for onboarding step
  const getTutorialIdForStep = (step: string): string | null => {
    const stepToTutorial: Record<string, string> = {
      welcome: "welcome",
      "user-type": "user-type-selection",
      "school-profile": "school-profile-setup",
      "student-profile": "student-profile-setup",
      programs: "school-profile-setup",
      rotations: "school-profile-setup",
    }
    return stepToTutorial[step] || null
  }

  // Start tutorial
  const startTutorial = useCallback(
    (tutorialId: string) => {
      const config = TUTORIAL_CONFIGS[tutorialId]
      if (!config || !tutorialState.userPreferences.enabled) return

      // Note: Accessibility settings would be applied at the component level

      saveTutorialState({
        isActive: true,
        currentTutorial: tutorialId,
        currentStep: 0,
        isPaused: false,
      })

      // Play sound if enabled
      if (tutorialState.userPreferences.playSound) {
        playTutorialSound("start")
      }

      // Announce to screen readers
      if (tutorialState.userPreferences.voiceOver) {
        announceToScreenReader(`Starting tutorial: ${config.title}`)
      }
    },
    [tutorialState.userPreferences, saveTutorialState, announceToScreenReader, playTutorialSound]
  )

  // Load user preferences and tutorial state
  const loadTutorialState = useCallback(() => {
    try {
      const savedState = localStorage.getItem(`tutorial-state-${userId || "anonymous"}`)
      if (savedState) {
        const parsed = JSON.parse(savedState)
        setTutorialState((prev) => ({
          ...prev,
          ...parsed,
          userPreferences: { ...DEFAULT_SETTINGS, ...parsed.userPreferences },
        }))
      }

      // Check if we should auto-start based on onboarding step
      if (onboardingStep && tutorialState.userPreferences.autoStart) {
        const tutorialId = getTutorialIdForStep(onboardingStep)
        if (tutorialId && !tutorialState.completedTutorials.includes(tutorialId)) {
          setTimeout(() => startTutorial(tutorialId), 1000)
        }
      }
    } catch (error) {
      console.error("Failed to load tutorial state:", error)
    }
  }, [
    userId,
    onboardingStep,
    tutorialState.userPreferences.autoStart,
    tutorialState.completedTutorials,
    getTutorialIdForStep,
    startTutorial,
  ])

  // Stop tutorial
  const stopTutorial = useCallback(
    (completed = false) => {
      if (tutorialState.currentTutorial) {
        const updatedCompleted = completed
          ? [...tutorialState.completedTutorials, tutorialState.currentTutorial]
          : tutorialState.completedTutorials

        const updatedSkipped =
          !completed && !tutorialState.completedTutorials.includes(tutorialState.currentTutorial!)
            ? [...tutorialState.skippedTutorials, tutorialState.currentTutorial]
            : tutorialState.skippedTutorials

        saveTutorialState({
          isActive: false,
          currentTutorial: null,
          currentStep: 0,
          isPaused: false,
          completedTutorials: updatedCompleted,
          skippedTutorials: updatedSkipped,
        })

        if (tutorialState.userPreferences.playSound) {
          playTutorialSound(completed ? "complete" : "cancel")
        }

        if (tutorialState.userPreferences.voiceOver) {
          announceToScreenReader(completed ? "Tutorial completed" : "Tutorial cancelled")
        }
      }
    },
    [tutorialState, saveTutorialState, announceToScreenReader, playTutorialSound]
  )

  // Pause/Resume tutorial
  const togglePause = useCallback(() => {
    saveTutorialState({ isPaused: !tutorialState.isPaused })

    if (tutorialState.userPreferences.voiceOver) {
      announceToScreenReader(tutorialState.isPaused ? "Tutorial resumed" : "Tutorial paused")
    }
  }, [
    tutorialState.isPaused,
    tutorialState.userPreferences.voiceOver,
    saveTutorialState,
    announceToScreenReader,
  ])

  // Restart tutorial
  const restartTutorial = useCallback(() => {
    if (tutorialState.currentTutorial) {
      saveTutorialState({ currentStep: 0, isPaused: false })

      if (tutorialState.userPreferences.voiceOver) {
        announceToScreenReader("Tutorial restarted")
      }
    }
  }, [
    tutorialState.currentTutorial,
    tutorialState.userPreferences.voiceOver,
    saveTutorialState,
    announceToScreenReader,
  ])

  // Update preferences
  const updatePreferences = useCallback(
    (updates: Partial<TutorialSettings>) => {
      const newPreferences = { ...tutorialState.userPreferences, ...updates }
      saveTutorialState({ userPreferences: newPreferences })
    },
    [tutorialState.userPreferences, saveTutorialState]
  )

  // Keyboard shortcuts
  useHotkeys(
    "ctrl+h, cmd+h",
    () => {
      if (tutorialState.userPreferences.keyboardNavigation) {
        setShowHelpButton(!showHelpButton)
      }
    },
    { enableOnFormTags: true }
  )

  useHotkeys(
    "escape",
    () => {
      if (tutorialState.isActive && tutorialState.userPreferences.keyboardNavigation) {
        stopTutorial(false)
      }
    },
    { enableOnFormTags: true }
  )

  useHotkeys(
    "space",
    (e) => {
      if (tutorialState.isActive && tutorialState.userPreferences.keyboardNavigation) {
        e.preventDefault()
        togglePause()
      }
    },
    { enableOnFormTags: false }
  )

  useHotkeys(
    "r",
    () => {
      if (tutorialState.isActive && tutorialState.userPreferences.keyboardNavigation) {
        restartTutorial()
      }
    },
    { enableOnFormTags: true }
  )

  // Initialize tooltips
  useEffect(() => {
    if (tutorialState.userPreferences.showHints) {
      const elements = document.querySelectorAll("[data-tooltip]")
      setTooltipElements(elements)
    }
  }, [tutorialState.userPreferences.showHints])

  // Load state on mount
  useEffect(() => {
    loadTutorialState()
  }, [loadTutorialState])

  // Apply accessibility preferences
  useEffect(() => {
    const root = document.documentElement

    if (tutorialState.userPreferences.highContrast) {
      root.classList.add("tutorial-high-contrast")
    } else {
      root.classList.remove("tutorial-high-contrast")
    }

    if (tutorialState.userPreferences.reducedMotion) {
      root.classList.add("tutorial-reduced-motion")
    } else {
      root.classList.remove("tutorial-reduced-motion")
    }

    root.style.setProperty(
      "--tutorial-font-size",
      {
        small: "0.875rem",
        medium: "1rem",
        large: "1.125rem",
      }[tutorialState.userPreferences.fontSize]
    )

    root.style.setProperty(
      "--tutorial-animation-speed",
      tutorialState.userPreferences.animationSpeed.toString()
    )
  }, [tutorialState.userPreferences])

  const currentConfig = tutorialState.currentTutorial
    ? TUTORIAL_CONFIGS[tutorialState.currentTutorial]
    : null

  return (
    <TooltipProvider>
      <div className={cn("tutorial-integration relative", className)}>
        {/* Main Content with Tooltip Wrappers */}
        <div className="tutorial-content">{children}</div>

        {/* Floating Help Button */}
        <AnimatePresence>
          {showHelpButton && !tutorialState.isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              className="fixed right-6 bottom-6 z-50"
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="lg"
                    className="rounded-full shadow-lg transition-all duration-200 hover:shadow-xl"
                    onClick={() => setTutorialState((prev) => ({ ...prev, showProgress: true }))}
                    aria-label="Open tutorial help"
                  >
                    <HelpCircle className="h-6 w-6" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Need help? Click for tutorials and guidance</p>
                  <p className="mt-1 text-gray-500 text-xs">Ctrl+H to toggle</p>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tutorial Controls */}
        <AnimatePresence>
          {tutorialState.isActive && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="fixed top-4 right-4 z-50"
            >
              <Card className="shadow-lg">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {currentConfig?.title}
                    </Badge>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={togglePause}
                        aria-label={tutorialState.isPaused ? "Resume tutorial" : "Pause tutorial"}
                      >
                        {tutorialState.isPaused ? (
                          <Play className="h-4 w-4" />
                        ) : (
                          <Pause className="h-4 w-4" />
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={restartTutorial}
                        aria-label="Restart tutorial"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => stopTutorial(false)}
                        aria-label="Close tutorial"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tutorial Progress Dialog */}
        <Dialog
          open={tutorialState.showProgress}
          onOpenChange={(open) => setTutorialState((prev) => ({ ...prev, showProgress: open }))}
        >
          <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Tutorial Progress & Help
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Object.entries(TUTORIAL_CONFIGS).map(([id, config]) => {
                  const isCompleted = tutorialState.completedTutorials.includes(id)
                  const isAvailable =
                    userRole === "SUPER_ADMIN" ||
                    config.steps.some((step) =>
                      document.querySelector(step.attachTo?.element || "")
                    )

                  return (
                    <Button
                      key={id}
                      variant={isCompleted ? "default" : "outline"}
                      className="flex h-auto flex-col items-start gap-1 p-3"
                      onClick={() => {
                        setTutorialState((prev) => ({ ...prev, showProgress: false }))
                        startTutorial(id)
                      }}
                      disabled={!isAvailable}
                    >
                      <div className="flex w-full items-center gap-2">
                        <span className="truncate font-medium text-sm">{config.title}</span>
                        {isCompleted && (
                          <Badge variant="secondary" className="text-xs">
                            ✓
                          </Badge>
                        )}
                      </div>
                      <span className="text-left text-gray-600 text-xs">{config.description}</span>
                    </Button>
                  )
                })}
              </div>

              {/* Tutorial Progress Component */}
              {userId && userRole && <TutorialProgress userId={userId} userRole={userRole} />}

              {/* Settings */}
              <Card>
                <CardContent className="p-4">
                  <div className="mb-4 flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <h3 className="font-semibold">Tutorial Settings</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="font-medium text-sm">Enable Tutorials</label>
                        <Switch
                          checked={tutorialState.userPreferences.enabled}
                          onCheckedChange={(checked) => updatePreferences({ enabled: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="font-medium text-sm">Auto-start on New Pages</label>
                        <Switch
                          checked={tutorialState.userPreferences.autoStart}
                          onCheckedChange={(checked) => updatePreferences({ autoStart: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="font-medium text-sm">Show Hints</label>
                        <Switch
                          checked={tutorialState.userPreferences.showHints}
                          onCheckedChange={(checked) => updatePreferences({ showHints: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="font-medium text-sm">Play Sounds</label>
                        <Switch
                          checked={tutorialState.userPreferences.playSound}
                          onCheckedChange={(checked) => updatePreferences({ playSound: checked })}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="font-medium text-sm">High Contrast</label>
                        <Switch
                          checked={tutorialState.userPreferences.highContrast}
                          onCheckedChange={(checked) =>
                            updatePreferences({ highContrast: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="font-medium text-sm">Reduced Motion</label>
                        <Switch
                          checked={tutorialState.userPreferences.reducedMotion}
                          onCheckedChange={(checked) =>
                            updatePreferences({ reducedMotion: checked })
                          }
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <label className="font-medium text-sm">Keyboard Navigation</label>
                        <Switch
                          checked={tutorialState.userPreferences.keyboardNavigation}
                          onCheckedChange={(checked) =>
                            updatePreferences({ keyboardNavigation: checked })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="font-medium text-sm">Animation Speed</label>
                        <Slider
                          value={[tutorialState.userPreferences.animationSpeed]}
                          onValueChange={([value]) => updatePreferences({ animationSpeed: value })}
                          min={0.5}
                          max={2}
                          step={0.1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-gray-500 text-xs">
                          <span>Slow</span>
                          <span>Fast</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </DialogContent>
        </Dialog>

        {/* Active Tutorial Components */}
        {tutorialState.isActive && currentConfig && (
          <>
            <TutorialOverlay
              steps={currentConfig.steps.map((step) => ({
                id: step.id,
                title: step.title,
                content: step.text,
                target: step.attachTo?.element,
                position:
                  step.attachTo?.on === "top"
                    ? "top"
                    : step.attachTo?.on === "bottom"
                      ? "bottom"
                      : step.attachTo?.on === "left"
                        ? "left"
                        : step.attachTo?.on === "right"
                          ? "right"
                          : "center",
              }))}
              isActive={tutorialState.isActive && !tutorialState.isPaused}
              currentStepIndex={tutorialState.currentStep}
              onComplete={() => stopTutorial(true)}
              onSkip={() => stopTutorial(false)}
              onClose={() => stopTutorial(false)}
              className="tutorial-overlay"
            />

            <GuidedWalkthrough
              config={currentConfig}
              isActive={tutorialState.isActive && !tutorialState.isPaused}
              onStepChange={(step) => saveTutorialState({ currentStep: step })}
              onComplete={() => stopTutorial(true)}
              onSkip={() => stopTutorial(false)}
              onCancel={() => stopTutorial(false)}
            />
          </>
        )}

        {/* Tooltip Elements */}
        {tutorialState.userPreferences.showHints &&
          tooltipElements &&
          Array.from(tooltipElements).map((element, index) => {
            const tooltipContent = element.getAttribute("data-tooltip")
            const _tooltipType = element.getAttribute("data-tooltip-type") as string | null

            if (!tooltipContent) return null

            return (
              <TooltipWrapper
                key={`tooltip-${tooltipContent.slice(0, 20)}-${index}`}
                tooltip={{
                  description: tooltipContent,
                }}
              >
                <div />
              </TooltipWrapper>
            )
          })}

        {/* Accessibility Styles */}
        <style jsx global>{`
          .tutorial-high-contrast {
            --tutorial-bg: #000000;
            --tutorial-text: #ffffff;
            --tutorial-border: #ffffff;
            --tutorial-accent: #ffff00;
          }
          
          .tutorial-reduced-motion * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
          
          .tutorial-overlay {
            font-size: var(--tutorial-font-size, 1rem);
          }
          
          .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
          }
          
          @media (prefers-reduced-motion: reduce) {
            .tutorial-integration * {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
            }
          }
        `}</style>
      </div>
    </TooltipProvider>
  )
}
