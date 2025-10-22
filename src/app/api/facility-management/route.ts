import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/database/db"
import { facilityManagement } from "@/database/schema"
import { getSchoolContext } from "@/lib/school-utils"
import { eq, and, desc, sql } from "drizzle-orm"
import { z } from "zod"

// Request validation schemas
const facilityManagementSchema = z.object({
  facilityName: z.string().min(1).max(200),
  facilityType: z.enum(['hospital', 'clinic', 'nursing_home', 'outpatient', 'emergency', 'pharmacy', 'laboratory', 'other']),
  address: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  geofenceRadius: z.number().min(10).max(1000).optional().default(100),
  isActive: z.boolean().optional().default(true),
  isCustom: z.boolean().optional().default(false),
  osmId: z.string().optional(),
  priority: z.number().min(0).max(100).optional().default(0),
  contactInfo: z.record(z.any()).optional().default({}),
  operatingHours: z.record(z.any()).optional().default({}),
  specialties: z.array(z.string()).optional().default([]),
  notes: z.string().optional(),
})

const updateFacilitySchema = facilityManagementSchema.partial()

// GET /api/facility-management - Get managed facilities for school
export async function GET(request: NextRequest) {
  try {
    // Get school context
    const context = await getSchoolContext()
    if (!context.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { user, school } = context.data

    // Check if user has admin permissions
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'CLINICAL_SUPERVISOR'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse query parameters
    const url = new URL(request.url)
    const isActive = url.searchParams.get('active')
    const facilityType = url.searchParams.get('type')
    const limit = Number.parseInt(url.searchParams.get('limit') || '50')
    const offset = Number.parseInt(url.searchParams.get('offset') || '0')

    // Build query conditions
    const conditions = [eq(facilityManagement.schoolId, school.id)]
    
    if (isActive !== null) {
      conditions.push(eq(facilityManagement.isActive, isActive === 'true'))
    }
    
    if (facilityType) {
      conditions.push(eq(facilityManagement.facilityType, facilityType))
    }

    // Get facilities
    const facilities = await db
      .select()
      .from(facilityManagement)
      .where(and(...conditions))
      .orderBy(desc(facilityManagement.priority), desc(facilityManagement.createdAt))
      .limit(limit)
      .offset(offset)

    // Get total count
    const [totalCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(facilityManagement)
      .where(and(...conditions))

    return NextResponse.json({
      success: true,
      data: {
        facilities: facilities.map(facility => ({
          id: facility.id,
          facilityName: facility.facilityName,
          facilityType: facility.facilityType,
          address: facility.address,
          latitude: Number.parseFloat(facility.latitude),
          longitude: Number.parseFloat(facility.longitude),
          geofenceRadius: facility.geofenceRadius,
          isActive: facility.isActive,
          isCustom: facility.isCustom,
          osmId: facility.osmId,
          priority: facility.priority,
          contactInfo: facility.contactInfo,
          operatingHours: facility.operatingHours,
          specialties: facility.specialties,
          notes: facility.notes,
          createdAt: facility.createdAt,
          updatedAt: facility.updatedAt,
        })),
        pagination: {
          total: totalCount.count,
          limit,
          offset,
          hasMore: offset + limit < totalCount.count,
        },
        timestamp: new Date().toISOString(),
      }
    })

  } catch (error) {
    console.error('Facility management GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/facility-management - Create new managed facility
export async function POST(request: NextRequest) {
  try {
    // Get school context
    const context = await getSchoolContext()
    if (!context.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { user, school } = context.data

    // Check if user has admin permissions
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const validationResult = facilityManagementSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const facilityData = validationResult.data

    // Create new facility
    const [newFacility] = await db
      .insert(facilityManagement)
      .values({
        schoolId: school.id,
        createdBy: user.id,
        ...facilityData,
        latitude: facilityData.latitude.toString(),
        longitude: facilityData.longitude.toString(),
      })
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        facility: {
          id: newFacility.id,
          facilityName: newFacility.facilityName,
          facilityType: newFacility.facilityType,
          address: newFacility.address,
          latitude: Number.parseFloat(newFacility.latitude),
          longitude: Number.parseFloat(newFacility.longitude),
          geofenceRadius: newFacility.geofenceRadius,
          isActive: newFacility.isActive,
          isCustom: newFacility.isCustom,
          osmId: newFacility.osmId,
          priority: newFacility.priority,
          contactInfo: newFacility.contactInfo,
          operatingHours: newFacility.operatingHours,
          specialties: newFacility.specialties,
          notes: newFacility.notes,
          createdAt: newFacility.createdAt,
          updatedAt: newFacility.updatedAt,
        },
        message: 'Facility created successfully',
        timestamp: new Date().toISOString(),
      }
    })

  } catch (error) {
    console.error('Facility management POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/facility-management/[id] - Update managed facility
export async function PUT(request: NextRequest) {
  try {
    // Get school context
    const context = await getSchoolContext()
    if (!context.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { user, school } = context.data

    // Check if user has admin permissions
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Extract facility ID from URL
    const url = new URL(request.url)
    const facilityId = url.pathname.split('/').pop()

    if (!facilityId) {
      return NextResponse.json(
        { error: 'Facility ID required' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const validationResult = updateFacilitySchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const updates = validationResult.data

    // Convert latitude/longitude to strings if provided
    const updateData: any = { ...updates }
    if (updates.latitude !== undefined) {
      updateData.latitude = updates.latitude.toString()
    }
    if (updates.longitude !== undefined) {
      updateData.longitude = updates.longitude.toString()
    }

    // Update facility
    const [updatedFacility] = await db
      .update(facilityManagement)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(facilityManagement.id, facilityId),
          eq(facilityManagement.schoolId, school.id)
        )
      )
      .returning()

    if (!updatedFacility) {
      return NextResponse.json(
        { error: 'Facility not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        facility: {
          id: updatedFacility.id,
          facilityName: updatedFacility.facilityName,
          facilityType: updatedFacility.facilityType,
          address: updatedFacility.address,
          latitude: Number.parseFloat(updatedFacility.latitude),
          longitude: Number.parseFloat(updatedFacility.longitude),
          geofenceRadius: updatedFacility.geofenceRadius,
          isActive: updatedFacility.isActive,
          isCustom: updatedFacility.isCustom,
          osmId: updatedFacility.osmId,
          priority: updatedFacility.priority,
          contactInfo: updatedFacility.contactInfo,
          operatingHours: updatedFacility.operatingHours,
          specialties: updatedFacility.specialties,
          notes: updatedFacility.notes,
          createdAt: updatedFacility.createdAt,
          updatedAt: updatedFacility.updatedAt,
        },
        message: 'Facility updated successfully',
        timestamp: new Date().toISOString(),
      }
    })

  } catch (error) {
    console.error('Facility management PUT error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/facility-management/[id] - Delete managed facility
export async function DELETE(request: NextRequest) {
  try {
    // Get school context
    const context = await getSchoolContext()
    if (!context.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { user, school } = context.data

    // Check if user has admin permissions
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Extract facility ID from URL
    const url = new URL(request.url)
    const facilityId = url.pathname.split('/').pop()

    if (!facilityId) {
      return NextResponse.json(
        { error: 'Facility ID required' },
        { status: 400 }
      )
    }

    // Delete facility
    const deleted = await db
      .delete(facilityManagement)
      .where(
        and(
          eq(facilityManagement.id, facilityId),
          eq(facilityManagement.schoolId, school.id)
        )
      )

    if (deleted.rowCount === 0) {
      return NextResponse.json(
        { error: 'Facility not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        message: 'Facility deleted successfully',
        timestamp: new Date().toISOString(),
      }
    })

  } catch (error) {
    console.error('Facility management DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}