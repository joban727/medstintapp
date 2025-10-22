import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/database/db'
import { locationPermissions } from '@/database/schema'
import { eq, sql } from 'drizzle-orm'

interface LocationPermissionRequest {
  permissionStatus: 'granted' | 'denied' | 'prompt'
  browserInfo?: string
  deviceInfo?: string
  metadata?: any
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

    // Get latest permission status for user
    const permissions = await db
      .select()
      .from(locationPermissions)
      .where(eq(locationPermissions.userId, userId))
      .orderBy(sql`${locationPermissions.updatedAt} DESC`)
      .limit(1)

    if (permissions.length === 0) {
      return NextResponse.json({
        hasPermission: false,
        permissionStatus: 'unknown',
        message: 'No location permission record found'
      }, { status: 200 })
    }

    const permission = permissions[0]

    return NextResponse.json({
      hasPermission: permission.permissionStatus === 'granted',
      permissionStatus: permission.permissionStatus,
      lastUpdated: permission.updatedAt,
      browserInfo: permission.browserInfo,
      deviceInfo: permission.deviceInfo,
    }, { status: 200 })

  } catch (error) {
    console.error('Location permission check error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to check location permissions'
      },
      { status: 500 }
    )
  }
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
      permissionStatus,
      browserInfo,
      deviceInfo,
      metadata
    }: LocationPermissionRequest = body

    // Validate input
    if (!permissionStatus || !['granted', 'denied', 'prompt'].includes(permissionStatus)) {
      return NextResponse.json(
        { error: 'Invalid permission status' },
        { status: 400 }
      )
    }

    // Save or update permission record
    const permissionRecord = await db
      .insert(locationPermissions)
      .values({
        userId,
        permissionStatus,
        browserInfo,
        deviceInfo,
        metadata: metadata ? JSON.stringify(metadata) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: locationPermissions.userId,
        set: {
          permissionStatus,
          browserInfo,
          deviceInfo,
          metadata: metadata ? JSON.stringify(metadata) : null,
          updatedAt: new Date(),
        }
      })
      .returning()

    const permission = permissionRecord[0]

    return NextResponse.json({
      success: true,
      permissionId: permission.id,
      permissionStatus: permission.permissionStatus,
      hasPermission: permission.permissionStatus === 'granted',
      timestamp: permission.updatedAt,
    }, { status: 200 })

  } catch (error) {
    console.error('Location permission update error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to update location permissions'
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Delete all permission records for user
    await db
      .delete(locationPermissions)
      .where(eq(locationPermissions.userId, userId))

    return NextResponse.json({
      success: true,
      message: 'Location permissions cleared'
    }, { status: 200 })

  } catch (error) {
    console.error('Location permission deletion error:', error)
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to clear location permissions'
      },
      { status: 500 }
    )
  }
}