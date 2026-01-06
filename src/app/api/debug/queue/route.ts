import { NextResponse } from "next/server"
import { QueueManager } from "@/lib/queue"
import { processNextJob } from "@/workers/email.worker"
import { withCSRF } from "@/lib/csrf-middleware"

export const POST = withCSRF(async (request: Request) => {
  try {
    const body = await request.json()
    const { action, email, subject } = body

    if (action === "process-one") {
      // Manually trigger processing of one job (useful for serverless/cron)
      const result = await processNextJob()
      return NextResponse.json({
        message: result ? "Job processed" : "No jobs pending",
        result,
      })
    }

    if (action === "add-job") {
      const job = await QueueManager.add("EMAIL", {
        to: email || "test@example.com",
        subject: subject || "Test Email from DB Queue",
        body: "This is a test email processed by Postgres.",
      })
      return NextResponse.json({ message: "Job added", jobId: job.id })
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    console.error("Queue error:", error)
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    )
  }
})
