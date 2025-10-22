import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/database/db'
import { 
  timeRecords, 
  locationVerifications, 
  locationAccuracyLogs,
  locationPermissions 
} from '@/database/schema'
import { eq, and } from 'drizzle-orm'

interface LocationCaptureRequest {
  timeRecordId: string
  captureType: 'clock_in' | 'clock_out'
  latitude: number
  longitude: number
  accuracy: number
  source: 'gps' | 'network' | 'passive'
  timestamp: string
  metadata?: any
}

interface LocationValidationResult {
  isValid: boolean
  accuracy: 'high' | 'medium' | 'low'
  warnings: string[]
  errors: string[]
}

function validateLocationData(data: LocationCaptureRequest): LocationValidationResult {
  const result: LocationValidationResult = {
    isValid: true,
    accuracy: 'high',
    warnings: [],
    errors: []
  }

  // Validate latitude
  if (typeof data.latitude !== 'number' || data.latitude < -90 || data.latitude > 90) {
    result.errors.push('Invalid latitude value')
    result.isValid = false
  }

  // Validate longitude
  if (typeof data.longitude !== 'number' || data.longitude < -180 || data.longitude > 180) {
    result.errors.push('Invalid longitude value')
    result.isValid = false
  }

  // Validate accuracy
  if (typeof data.accuracy !== 'number' || data.accuracy < 0) {
    result.errors.push('Invalid accuracy value')
    result.isValid = false
  }

  // Validate source
  if (!['gps', 'network', 'passive'].includes(data.source)) {
    result.errors.push('Invalid location source')
    result.isValid = false
  }

  // Validate capture type
  if (!['clock_in', 'clock_out'].includes(data.captureType)) {
    result.errors.push('Invalid capture type')
    result.isValid = false
  }

  // Validate timestamp (should be within reasonable range)
  const now = Date.now()
  const timeDiff = Math.abs(now - data.timestamp)
  if (timeDiff > 300000) { // 5 minutes
    result.warnings.push('Location timestamp is more than 5 minutes old')
  }

  // Determine accuracy level
  if (data.accuracy <= 10) {
    result.accuracy = 'high'
  } else if (data.accuracy <= 50) {
    result.accuracy = 'medium'
  } else {
    result.accuracy = 'low'
    result.warnings.push(`Location accuracy is low (±${Math.round(data.accuracy)}m)`)
  }

  // Check for suspicious accuracy values
  if (data.accuracy > 1000) {
    result.warnings.push('Very poor location accuracy detected')
  }

  return result
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      timeRecordId,
      captureType,
      latitude,
      longitude,
      accuracy,
      source,
      timestamp,
      metadata
    }: LocationCaptureRequest = body

    // Validate input data
    const validation = validateLocationData(body)
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Invalid location data',
          details: validation.errors
        },
        { status: 400 }
      )
    }

    // Verify the time record exists and belongs to the user
    const existingRecord = await db
      .select()
      .from(timeRecords)
      .where(
        and(
          eq(timeRecords.id, timeRecordId),
          eq(timeRecords.studentId, userId)
        )
      )
      .limit(1)

    if (existingRecord.length === 0) {
      return NextResponse.json(
        { error: 'Time record not found or access denied' },
        { status: 404 }
      )
    }

    const record = existingRecord[0]

    // Prepare update data based on capture type
    const updateData: any = {}
    
    if (captureType === 'clock_in') {
      // Check if clock-in location already exists
      if (record.clockInLatitude !== null) {
        return NextResponse.json(
          { error: 'Clock-in location already captured' },
          { status: 409 }
        )
      }
      
      updateData.clockInLatitude = latitude.toString()
      updateData.clockInLongitude = longitude.toString()
      updateData.clockInAccuracy = accuracy
      updateData.clockInSource = source
    } else if (captureType === 'clock_out') {
      // Check if clock-out location already exists
      if (record.clockOutLatitude !== null) {
        return NextResponse.json(
          { error: 'Clock-out location already captured' },
          { status: 409 }
        )
      }
      
      updateData.clockOutLatitude = latitude.toString()
      updateData.clockOutLongitude = longitude.toString()
      updateData.clockOutAccuracy = accuracy
      updateData.clockOutSource = source
    }

    // Update the time record with location data
    await db
      .update(timeRecords)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(timeRecords.id, timeRecordId))

    // Log accuracy data for analytics
    await db
      .insert(locationAccuracyLogs)
      .values({
        userId,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        accuracy,
        source,
        verificationType: captureType,
        verificationStatus: validation.accuracy === 'high' ? 'approved' : 'flagged',
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date(),
      })

    // Prepare response
    const response = {
      success: true,
      timeRecordId,
      captureType,
      location: {
        latitude,
        longitude,
        accuracy,
        source
      },
      validation: {
        accuracy: validation.accuracy,
        warnings: validation.warnings
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Location capture error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to capture location data'
      },
      { status: 500 }
    )
  }
}

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
    const timeRecordId = searchParams.get('timeRecordId')

    if (!timeRecordId) {
      return NextResponse.json(
        { error: 'Time record ID is required' },
        { status: 400 }
      )
    }

    // Get location data for the specified time record
    const record = await db
      .select({
        id: timeRecords.id,
        clockInLatitude: timeRecords.clockInLatitude,
        clockInLongitude: timeRecords.clockInLongitude,
        clockInAccuracy: timeRecords.clockInAccuracy,
        clockInSource: timeRecords.clockInSource,
        clockOutLatitude: timeRecords.clockOutLatitude,
        clockOutLongitude: timeRecords.clockOutLongitude,
        clockOutAccuracy: timeRecords.clockOutAccuracy,
        clockOutSource: timeRecords.clockOutSource,
        clockIn: timeRecords.clockIn,
        clockOut: timeRecords.clockOut
      })
      .from(timeRecords)
      .where(
        and(
          eq(timeRecords.id, timeRecordId),
          eq(timeRecords.studentId, userId)
        )
      )
      .limit(1)

    if (record.length === 0) {
      return NextResponse.json(
        { error: 'Time record not found or access denied' },
        { status: 404 }
      )
    }

    const timeRecord = record[0]

    // Format response
    const response = {
      timeRecordId: timeRecord.id,
      clockIn: {
        timestamp: timeRecord.clockIn,
        location: timeRecord.clockInLatitude && timeRecord.clockInLongitude ? {
          latitude: Number.parseFloat(timeRecord.clockInLatitude),
          longitude: Number.parseFloat(timeRecord.clockInLongitude),
          accuracy: timeRecord.clockInAccuracy,
          source: timeRecord.clockInSource
        } : null
      },
      clockOut: {
        timestamp: timeRecord.clockOut,
        location: timeRecord.clockOutLatitude && timeRecord.clockOutLongitude ? {
          latitude: Number.parseFloat(timeRecord.clockOutLatitude),
          longitude: Number.parseFloat(timeRecord.clockOutLongitude),
          accuracy: timeRecord.clockOutAccuracy,
          source: timeRecord.clockOutSource
        } : null
      }
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Location retrieval error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve location data'
      },
      { status: 500 }
    )
  }
}