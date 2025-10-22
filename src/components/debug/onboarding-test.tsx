"use client"

import { useState } from "react"
import { Button } from "../ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

export function OnboardingTest() {
  const [step, setStep] = useState(1)
  const [userType, setUserType] = useState<"school" | "student" | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`])
    // Debug logging disabled in production
  }

  const handleUserTypeSelect = (type: "school" | "student") => {
    addLog(`User type selected: ${type}`)
    setUserType(type)
    setStep(2)
  }

  const handleNext = () => {
    addLog(`Next button clicked from step ${step}`)
    setStep((prev) => prev + 1)
  }

  const handleBack = () => {
    addLog(`Back button clicked from step ${step}`)
    setStep((prev) => prev - 1)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Onboarding Debug Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p>
                <strong>Current Step:</strong> {step}
              </p>
              <p>
                <strong>User Type:</strong> {userType || "Not selected"}
              </p>
            </div>

            {step === 1 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Step 1: Select User Type</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    onClick={() => handleUserTypeSelect("school")}
                    variant="outline"
                    className="h-20"
                  >
                    School Admin
                  </Button>
                  <Button
                    onClick={() => handleUserTypeSelect("student")}
                    variant="outline"
                    className="h-20"
                  >
                    Student
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Step 2: Registration Form</h3>
                <p>This would be the {userType} registration form.</p>
                <div className="flex gap-2">
                  <Button onClick={handleBack} variant="outline">
                    Back
                  </Button>
                  <Button onClick={handleNext}>Next</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Step 3: Completion</h3>
                <p>Onboarding completed for {userType}!</p>
                <Button onClick={handleBack} variant="outline">
                  Back
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto rounded bg-gray-100 p-4">
              {logs.length === 0 ? (
                <p className="text-gray-500">No logs yet...</p>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={`log-${log.substring(0, 20).replace(/[^a-zA-Z0-9]/g, "-")}-${index}`}
                    className="font-mono text-sm"
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
