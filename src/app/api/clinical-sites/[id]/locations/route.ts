import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/database/db'
import { clinicalSiteLocations, clinicalSites } from '@/database/schema'
import { eq, and } from 'drizzle-orm'

interface CreateLocationRequest {
  name: string
  latitude: number
  longitude: number
  radius: number
  description?: string
  floor?: string
  department?: string
  isPrimary?: boolean
}

interface UpdateLocationRequest extends Partial<CreateLocationRequest> {
  isActive?: boolean
}

// GET /api/clinical-sites/[id]/locations - Get all locations for a clinical site
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicalSiteId = params.id

    // Verify user has access to this clinical site
    const siteAccess = await db
      .select({ id: clinicalSites.id })
      .from(clinicalSites)
      .where(eq(clinicalSites.id, clinicalSiteId))
      .limit(1)

    if (siteAccess.length === 0) {
      return NextResponse.json(
        { error: 'Clinical site not found' },
        { status: 404 }
      )
    }

    // Get all locations for the clinical site
    const locations = await db
      .select({
        id: clinicalSiteLocations.id,
        clinicalSiteId: clinicalSiteLocations.clinicalSiteId,
        name: clinicalSiteLocations.name,
        latitude: clinicalSiteLocations.latitude,
        longitude: clinicalSiteLocations.longitude,
        radius: clinicalSiteLocations.radius,
        isActive: clinicalSiteLocations.isActive,
        isPrimary: clinicalSiteLocations.isPrimary,
        description: clinicalSiteLocations.description,
        floor: clinicalSiteLocations.floor,
        department: clinicalSiteLocations.department,
        createdAt: clinicalSiteLocations.createdAt,
        updatedAt: clinicalSiteLocations.updatedAt,
      })
      .from(clinicalSiteLocations)
      .where(eq(clinicalSiteLocations.clinicalSiteId, clinicalSiteId))
      .orderBy(clinicalSiteLocations.isPrimary, clinicalSiteLocations.name)

    return NextResponse.json({
      clinicalSiteId,
      locations: locations.map(location => ({
        ...location,
        latitude: Number.parseFloat(location.latitude),
        longitude: Number.parseFloat(location.longitude),
      })),
      total: locations.length,
    })

  } catch (error) {
    console.error('Error fetching clinical site locations:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/clinical-sites/[id]/locations - Create a new location for a clinical site
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicalSiteId = params.id
    const body = await request.json()
    
    const {
      name,
      latitude,
      longitude,
      radius,
      description,
      floor,
      department,
      isPrimary = false,
    }: CreateLocationRequest = body

    // Validate required fields
    if (!name || typeof latitude !== 'number' || typeof longitude !== 'number' || typeof radius !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields: name, latitude, longitude, radius' },
        { status: 400 }
      )
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      )
    }

    // Validate radius
    if (radius <= 0 || radius > 10000) {
      return NextResponse.json(
        { error: 'Radius must be between 1 and 10000 meters' },
        { status: 400 }
      )
    }

    // Verify clinical site exists
    const siteExists = await db
      .select({ id: clinicalSites.id })
      .from(clinicalSites)
      .where(eq(clinicalSites.id, clinicalSiteId))
      .limit(1)

    if (siteExists.length === 0) {
      return NextResponse.json(
        { error: 'Clinical site not found' },
        { status: 404 }
      )
    }

    // If this is set as primary, unset other primary locations
    if (isPrimary) {
      await db
        .update(clinicalSiteLocations)
        .set({ isPrimary: false })
        .where(
          and(
            eq(clinicalSiteLocations.clinicalSiteId, clinicalSiteId),
            eq(clinicalSiteLocations.isPrimary, true)
          )
        )
    }

    // Create the new location
    const newLocation = await db
      .insert(clinicalSiteLocations)
      .values({
        clinicalSiteId,
        name,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        radius,
        description,
        floor,
        department,
        isPrimary,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    const location = newLocation[0]

    return NextResponse.json({
      success: true,
      location: {
        ...location,
        latitude: Number.parseFloat(location.latitude),
        longitude: Number.parseFloat(location.longitude),
      },
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating clinical site location:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/clinical-sites/[id]/locations - Update a location
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicalSiteId = params.id
    const body = await request.json()
    
    const {
      locationId,
      name,
      latitude,
      longitude,
      radius,
      description,
      floor,
      department,
      isPrimary,
      isActive,
    } = body

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      )
    }

    // Validate coordinates if provided
    if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
      return NextResponse.json(
        { error: 'Invalid latitude' },
        { status: 400 }
      )
    }

    if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
      return NextResponse.json(
        { error: 'Invalid longitude' },
        { status: 400 }
      )
    }

    // Validate radius if provided
    if (radius !== undefined && (radius <= 0 || radius > 10000)) {
      return NextResponse.json(
        { error: 'Radius must be between 1 and 10000 meters' },
        { status: 400 }
      )
    }

    // Verify location exists and belongs to the clinical site
    const existingLocation = await db
      .select()
      .from(clinicalSiteLocations)
      .where(
        and(
          eq(clinicalSiteLocations.id, locationId),
          eq(clinicalSiteLocations.clinicalSiteId, clinicalSiteId)
        )
      )
      .limit(1)

    if (existingLocation.length === 0) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      )
    }

    // If setting as primary, unset other primary locations
    if (isPrimary === true) {
      await db
        .update(clinicalSiteLocations)
        .set({ isPrimary: false })
        .where(
          and(
            eq(clinicalSiteLocations.clinicalSiteId, clinicalSiteId),
            eq(clinicalSiteLocations.isPrimary, true)
          )
        )
    }

    // Prepare update data
    const updateData: any = { updatedAt: new Date() }
    
    if (name !== undefined) updateData.name = name
    if (latitude !== undefined) updateData.latitude = latitude.toString()
    if (longitude !== undefined) updateData.longitude = longitude.toString()
    if (radius !== undefined) updateData.radius = radius
    if (description !== undefined) updateData.description = description
    if (floor !== undefined) updateData.floor = floor
    if (department !== undefined) updateData.department = department
    if (isPrimary !== undefined) updateData.isPrimary = isPrimary
    if (isActive !== undefined) updateData.isActive = isActive

    // Update the location
    const updatedLocation = await db
      .update(clinicalSiteLocations)
      .set(updateData)
      .where(eq(clinicalSiteLocations.id, locationId))
      .returning()

    const location = updatedLocation[0]

    return NextResponse.json({
      success: true,
      location: {
        ...location,
        latitude: Number.parseFloat(location.latitude),
        longitude: Number.parseFloat(location.longitude),
      },
    })

  } catch (error) {
    console.error('Error updating clinical site location:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/clinical-sites/[id]/locations - Delete a location
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const clinicalSiteId = params.id
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      )
    }

    // Verify location exists and belongs to the clinical site
    const existingLocation = await db
      .select()
      .from(clinicalSiteLocations)
      .where(
        and(
          eq(clinicalSiteLocations.id, locationId),
          eq(clinicalSiteLocations.clinicalSiteId, clinicalSiteId)
        )
      )
      .limit(1)

    if (existingLocation.length === 0) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      )
    }

    // Delete the location
    await db
      .delete(clinicalSiteLocations)
      .where(eq(clinicalSiteLocations.id, locationId))

    return NextResponse.json({
      success: true,
      message: 'Location deleted successfully',
    })

  } catch (error) {
    console.error('Error deleting clinical site location:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}