import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/database/db'
import { 
  timeRecords, 
  clinicalSites, 
  clinicalSiteLocations, 
  locationVerifications,
  locationAccuracyLogs 
} from '@/database/schema'
import { eq, and } from 'drizzle-orm'

interface LocationVerificationRequest {
  verificationType: 'clock_in' | 'clock_out'
  userLatitude: number
  userLongitude: number
  userAccuracy: number
  locationSource: 'gps' | 'network' | 'passive'
  clinicalSiteLocationId?: string
  distanceFromSite: number
  isWithinGeofence: boolean
  verificationStatus: 'approved' | 'flagged' | 'rejected'
  flagReason?: string
  metadata?: any
}

interface ProximityCheck {
  isWithinRange: boolean
  distance: number
  allowedRadius: number
  siteName?: string
  siteAddress?: string
}

interface VerificationResult {
  isValid: boolean
  proximity: ProximityCheck
  accuracy: {
    level: 'high' | 'medium' | 'low'
    acceptable: boolean
    value: number
  }
  warnings: string[]
  errors: string[]
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3 // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c // Distance in meters
}

async function verifyLocationProximity(
  timeRecordId: string,
  userLatitude: number,
  userLongitude: number,
  userId: string
): Promise<ProximityCheck> {
  try {
    // Get the time record with rotation and site information
    const recordWithSite = await db
      .select({
        rotationId: timeRecords.rotationId,
        siteName: clinicalSites.name,
        siteAddress: clinicalSites.address,
        siteLatitude: clinicalSites.latitude,
        siteLongitude: clinicalSites.longitude,
        allowedRadius: clinicalSites.allowedRadius
      })
      .from(timeRecords)
      .leftJoin(clinicalSites, eq(timeRecords.rotationId, clinicalSites.id))
      .where(
        and(
          eq(timeRecords.id, timeRecordId),
          eq(timeRecords.studentId, userId)
        )
      )
      .limit(1)

    if (recordWithSite.length === 0) {
      return {
        isWithinRange: false,
        distance: 0,
        allowedRadius: 0
      }
    }

    const siteData = recordWithSite[0]

    // If no site coordinates are available, skip proximity check
    if (!siteData.siteLatitude || !siteData.siteLongitude) {
      return {
        isWithinRange: true, // Allow if no site coordinates
        distance: 0,
        allowedRadius: 0,
        siteName: siteData.siteName || undefined,
        siteAddress: siteData.siteAddress || undefined
      }
    }

    const siteLatitude = Number.parseFloat(siteData.siteLatitude)
    const siteLongitude = Number.parseFloat(siteData.siteLongitude)
    const allowedRadius = siteData.allowedRadius || 100 // Default 100m radius

    // Calculate distance between user location and site
    const distance = calculateDistance(
      userLatitude,
      userLongitude,
      siteLatitude,
      siteLongitude
    )

    return {
      isWithinRange: distance <= allowedRadius,
      distance: Math.round(distance),
      allowedRadius,
      siteName: siteData.siteName || undefined,
      siteAddress: siteData.siteAddress || undefined
    }

  } catch (error) {
    console.error('Proximity verification error:', error)
    return {
      isWithinRange: false,
      distance: 0,
      allowedRadius: 0
    }
  }
}

function validateLocationAccuracy(accuracy: number): {
  level: 'high' | 'medium' | 'low'
  acceptable: boolean
} {
  if (accuracy <= 10) {
    return { level: 'high', acceptable: true }
  }if (accuracy <= 50) {
    return { level: 'medium', acceptable: true }
  }if (accuracy <= 100) {
    return { level: 'low', acceptable: true }
  }
    return { level: 'low', acceptable: false }
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
      verificationType,
      userLatitude,
      userLongitude,
      userAccuracy,
      locationSource,
      clinicalSiteLocationId,
      distanceFromSite,
      isWithinGeofence,
      verificationStatus,
      flagReason,
      metadata
    }: LocationVerificationRequest = body

    // Validate input
    if (!verificationType || typeof userLatitude !== 'number' || typeof userLongitude !== 'number' || typeof userAccuracy !== 'number') {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      )
    }

    // Validate coordinate ranges
    if (userLatitude < -90 || userLatitude > 90 || userLongitude < -180 || userLongitude > 180) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      )
    }

    // Save location verification record
    const verificationRecord = await db
      .insert(locationVerifications)
      .values({
        userId,
        verificationType,
        userLatitude: userLatitude.toString(),
        userLongitude: userLongitude.toString(),
        userAccuracy,
        locationSource,
        clinicalSiteLocationId,
        distanceFromSite,
        isWithinGeofence,
        verificationStatus,
        flagReason,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date(),
      })
      .returning()

    // Log accuracy data for analytics
    await db
      .insert(locationAccuracyLogs)
      .values({
        userId,
        latitude: userLatitude.toString(),
        longitude: userLongitude.toString(),
        accuracy: userAccuracy,
        source: locationSource,
        verificationType,
        verificationStatus,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date(),
      })

    const verification = verificationRecord[0]

    return NextResponse.json({
      success: true,
      verificationId: verification.id,
      status: verificationStatus,
      isWithinGeofence,
      distanceFromSite,
      flagReason,
      timestamp: verification.createdAt,
    }, { status: 200 })

  } catch (error) {
    console.error('Location verification error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to save location verification'
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

    // Get site information for the time record
    const siteInfo = await db
      .select({
        siteName: clinicalSites.name,
        siteAddress: clinicalSites.address,
        siteLatitude: clinicalSites.latitude,
        siteLongitude: clinicalSites.longitude,
        allowedRadius: clinicalSites.allowedRadius,
        sitePhone: clinicalSites.phone,
        siteEmail: clinicalSites.email
      })
      .from(timeRecords)
      .leftJoin(clinicalSites, eq(timeRecords.rotationId, clinicalSites.id))
      .where(
        and(
          eq(timeRecords.id, timeRecordId),
          eq(timeRecords.studentId, userId)
        )
      )
      .limit(1)

    if (siteInfo.length === 0) {
      return NextResponse.json(
        { error: 'Time record not found or access denied' },
        { status: 404 }
      )
    }

    const site = siteInfo[0]

    const response = {
      timeRecordId,
      site: {
        name: site.siteName,
        address: site.siteAddress,
        coordinates: site.siteLatitude && site.siteLongitude ? {
          latitude: Number.parseFloat(site.siteLatitude),
          longitude: Number.parseFloat(site.siteLongitude)
        } : null,
        allowedRadius: site.allowedRadius || 100,
        contact: {
          phone: site.sitePhone,
          email: site.siteEmail
        }
      },
      requirements: {
        maxAccuracy: 100, // meters
        proximityRequired: !!site.siteLatitude && !!site.siteLongitude
      }
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Site info retrieval error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to retrieve site information'
      },
      { status: 500 }
    )
  }
}