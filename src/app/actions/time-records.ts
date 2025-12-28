"use server"

import { db } from "@/database/connection-pool"
import { timeRecords } from "@/database/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { auth } from "@clerk/nextjs/server"
import { getUserById } from "@/lib/rbac-middleware"

export async function approveTimeRecord(recordId: string) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const user = await getUserById(userId)
  if (!user || user.role !== "SCHOOL_ADMIN") {
    throw new Error("Unauthorized: Only School Admins can approve records")
  }

  await db
    .update(timeRecords)
    .set({
      status: "APPROVED",
      approvedBy: user.id,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(timeRecords.id, recordId))

  revalidatePath("/dashboard/school-admin/time-records")
}

export async function rejectTimeRecord(recordId: string) {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const user = await getUserById(userId)
  if (!user || user.role !== "SCHOOL_ADMIN") {
    throw new Error("Unauthorized: Only School Admins can reject records")
  }

  await db
    .update(timeRecords)
    .set({
      status: "REJECTED",
      updatedAt: new Date(),
    })
    .where(eq(timeRecords.id, recordId))

  revalidatePath("/dashboard/school-admin/time-records")
}
