import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/database/db'
import { timeRecords } from '@/database/schema'
import { eq, and, desc, sql } from 'drizzle-orm'

// GET /api/time-records/status - Get current clock status
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find the most recent time record for this student
    const [latestRecord] = await db
      .select({
        id: timeRecords.id,
        clockIn: timeRecords.clockIn,
        clockOut: timeRecords.clockOut,
        rotationId: timeRecords.rotationId,
        totalHours: timeRecords.totalHours
      })
      .from(timeRecords)
      .where(eq(timeRecords.studentId, userId))
      .orderBy(desc(timeRecords.clockIn))
      .limit(1)

    // Check if there's an active clock-in (no clock-out)
    const isClockedIn = latestRecord && !latestRecord.clockOut

    // Calculate total hours for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const todayRecords = await db
      .select({
        totalHours: sql`SUM(CAST(${timeRecords.totalHours} AS DECIMAL))`
      })
      .from(timeRecords)
      .where(
        and(
          eq(timeRecords.studentId, userId),
          sql`${timeRecords.clockIn} >= ${today.toISOString()}`
        )
      )

    const totalHoursToday = todayRecords[0]?.totalHours || 0

    return NextResponse.json({
      isClockedIn,
      currentRecord: isClockedIn ? {
        id: latestRecord.id,
        clockIn: latestRecord.clockIn,
        rotationId: latestRecord.rotationId
      } : null,
      lastClockIn: isClockedIn ? latestRecord.clockIn : null,
      totalHoursToday: totalHoursToday.toString()
    })

  } catch (error) {
    console.error('Error fetching clock status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}