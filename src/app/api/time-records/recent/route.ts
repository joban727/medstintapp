import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/database/db'
import { timeRecords } from '@/database/schema'
import { eq, desc } from 'drizzle-orm'

// GET /api/time-records/recent - Get recent time records
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get('limit') || '10')

    // Get recent time records for this student
    const records = await db
      .select({
        id: timeRecords.id,
        clockIn: timeRecords.clockIn,
        clockOut: timeRecords.clockOut,
        totalHours: timeRecords.totalHours,
        activities: timeRecords.activities,
        notes: timeRecords.notes,
        status: timeRecords.status,
        studentId: timeRecords.studentId,
        rotationId: timeRecords.rotationId,
        date: timeRecords.date
      })
      .from(timeRecords)
      .where(eq(timeRecords.studentId, userId))
      .orderBy(desc(timeRecords.clockIn))
      .limit(limit)

    return NextResponse.json({
      records: records.map(record => ({
        ...record,
        clockIn: record.clockIn.toISOString(),
        clockOut: record.clockOut?.toISOString()
      }))
    })

  } catch (error) {
    console.error('Error fetching recent time records:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}