import { db } from "@/database/connection-pool"
import { plans, schools, subscriptions, users } from "@/database/schema"
import { eq, and, sql } from "drizzle-orm"

export interface SystemStats {
  revenue: {
    totalMrr: number
    studentMrr: number
    schoolMrr: number
  }
  counts: {
    schools: number
    users: {
      total: number
      students: number
      admins: number
      preceptors: number
    }
    activeSubscriptions: number
  }
}

export async function getSystemStats(): Promise<SystemStats> {
  // Default stats to return on error
  const defaultStats: SystemStats = {
    revenue: { totalMrr: 0, studentMrr: 0, schoolMrr: 0 },
    counts: {
      schools: 0,
      users: { total: 0, students: 0, admins: 0, preceptors: 0 },
      activeSubscriptions: 0,
    },
  }

  try {
    // 1. Calculate Student MRR
    let studentMrr = 0
    try {
      const activeSubs = await db
        .select({
          planId: subscriptions.plan,
          interval: plans.interval,
          price: plans.price,
        })
        .from(subscriptions)
        .leftJoin(plans, eq(subscriptions.plan, plans.stripePriceId))
        .where(and(eq(subscriptions.status, "active"), eq(plans.type, "STUDENT_SUBSCRIPTION")))

      for (const sub of activeSubs) {
        if (sub.price) {
          const price = sub.price / 100
          studentMrr += sub.interval === "year" ? price / 12 : price
        }
      }
    } catch (subError) {
      console.warn("Error calculating student MRR:", subError)
    }

    // 2. Calculate School MRR
    let schoolMrr = 0
    try {
      const seatPlans = await db
        .select()
        .from(plans)
        .where(and(eq(plans.type, "SCHOOL_SEAT"), eq(plans.isActive, true)))
      const monthlySeatPlan = seatPlans.find((p) => p.interval === "month")
      const monthlySeatPrice = monthlySeatPlan ? monthlySeatPlan.price / 100 : 10

      const schoolsWithSeats = await db
        .select({ seatsUsed: schools.seatsUsed })
        .from(schools)
        .where(and(eq(schools.billingModel, "SCHOOL_PAYS"), sql`${schools.seatsUsed} > 0`))

      for (const school of schoolsWithSeats) {
        schoolMrr += (school.seatsUsed || 0) * monthlySeatPrice
      }
    } catch (schoolError) {
      console.warn("Error calculating school MRR:", schoolError)
    }

    // 3. Counts - with individual error handling
    let schoolCount = 0,
      userCount = 0,
      studentCount = 0,
      adminCount = 0,
      preceptorCount = 0,
      activeSubCount = 0

    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schools)
        .where(eq(schools.isActive, true))
      schoolCount = Number(result?.count || 0)
    } catch {
      /* ignore */
    }

    try {
      const [result] = await db.select({ count: sql<number>`count(*)` }).from(users)
      userCount = Number(result?.count || 0)
    } catch {
      /* ignore */
    }

    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.role, "STUDENT"))
      studentCount = Number(result?.count || 0)
    } catch {
      /* ignore */
    }

    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.role, "SCHOOL_ADMIN"))
      adminCount = Number(result?.count || 0)
    } catch {
      /* ignore */
    }

    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.role, "CLINICAL_PRECEPTOR"))
      preceptorCount = Number(result?.count || 0)
    } catch {
      /* ignore */
    }

    try {
      const [result] = await db
        .select({ count: sql<number>`count(*)` })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active"))
      activeSubCount = Number(result?.count || 0)
    } catch {
      /* ignore */
    }

    return {
      revenue: {
        totalMrr: studentMrr + schoolMrr,
        studentMrr,
        schoolMrr,
      },
      counts: {
        schools: schoolCount,
        users: {
          total: userCount,
          students: studentCount,
          admins: adminCount,
          preceptors: preceptorCount,
        },
        activeSubscriptions: activeSubCount,
      },
    }
  } catch (error) {
    console.error("Error in getSystemStats:", error)
    return defaultStats
  }
}
