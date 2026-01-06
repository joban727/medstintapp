import { db } from "../database/connection-pool"
import { notifications, users } from "../database/schema"
import { sendNotificationEmail } from "./email-service"
import { logger } from "./logger"
import { eq } from "drizzle-orm"

export async function notifyComplianceStatusChange({
  studentId,
  requirementName,
  status,
  notes,
}: {
  studentId: string
  requirementName: string
  status: "APPROVED" | "REJECTED" | "EXPIRED"
  notes?: string
}) {
  try {
    // 1. Get student email and name
    const [student] = await db.select().from(users).where(eq(users.id, studentId)).limit(1)

    if (!student) return

    const title = `Compliance Update: ${requirementName}`
    let message = ""
    let type: "success" | "warning" | "error" | "info" = "info"

    if (status === "APPROVED") {
      message = `Your submission for "${requirementName}" has been approved.`
      type = "success"
    } else if (status === "REJECTED") {
      message = `Your submission for "${requirementName}" was rejected. Reason: ${notes || "No reason provided."}`
      type = "error"
    } else if (status === "EXPIRED") {
      message = `Your compliance requirement "${requirementName}" has expired. Please submit a new one.`
      type = "warning"
    }

    // 2. Create in-app notification
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      userId: studentId,
      title,
      message,
      type,
      priority: status === "APPROVED" ? "low" : "high",
      actionUrl: "/dashboard/student/compliance",
    })

    // 3. Send email notification
    if (student.email) {
      await sendNotificationEmail({
        to: student.email,
        subject: title,
        message,
        actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/student/compliance`,
        actionText: "View Compliance Center",
      })
    }
  } catch (error) {
    logger.error({ err: error, studentId }, "Failed to send compliance notification")
  }
}
