import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dbMock } from '@/test/mocks/stateful-db'
import { facilityManagement, clinicalSiteLocations, clinicalSites, schools, users } from '@/database/schema'
import { NextRequest } from 'next/server'

// Mock database
vi.mock('@/database/connection-pool', () => ({
    db: {
        select: (fields: any) => dbMock.select(fields),
        insert: (table: any) => dbMock.insert(table),
        update: (table: any) => dbMock.update(table),
        delete: (table: any) => dbMock.delete(table),
        execute: vi.fn().mockResolvedValue([{ test: 1 }]),
        transaction: (callback: any) => callback({
            select: (fields: any) => dbMock.select(fields),
            insert: (table: any) => dbMock.insert(table),
            update: (table: any) => dbMock.update(table),
            delete: (table: any) => dbMock.delete(table),
        })
    }
}))

// Mock auth-clerk directly
vi.mock('@/lib/auth-clerk', () => ({
    getCurrentUser: vi.fn(),
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    isSuperAdmin: vi.fn(),
    getRoleDashboardRoute: vi.fn((role: string) => `/dashboard/${role.toLowerCase()}`)
}))

// Mock CSRF middleware
vi.mock('@/lib/csrf-middleware', () => ({
    withCSRF: (handler: any) => handler,
}))

describe('Facility Management Workflow', () => {
    let POST: any
    let PUT: any
    let getCurrentUserMock: any

    beforeEach(async () => {
        vi.resetModules()
        dbMock.reset()
        vi.clearAllMocks()

        // Dynamically import schema to ensure we have the same instances as the route (due to resetModules)
        const schema = await import('@/database/schema')

        // Register tables
        dbMock.registerTable(schema.facilityManagement, 'facility_management')
        dbMock.registerTable(schema.clinicalSiteLocations, 'clinical_site_locations')
        dbMock.registerTable(schema.clinicalSites, 'clinical_sites')
        dbMock.registerTable(schema.schools, 'schools')
        dbMock.registerTable(schema.users, 'users')

        // Import mocked auth-clerk
        const authClerk = await import('@/lib/auth-clerk')
        getCurrentUserMock = authClerk.getCurrentUser

        // Dynamically import route handlers
        const route = await import('@/app/api/facility-management/route')
        POST = route.POST
        PUT = route.PUT
    })

    it('should create a new facility with strict geofencing', async () => {
        const userId = 'admin_123'
        const schoolId = 'school_123'
        const clinicalSiteId = 'site_123'

        // Seed DB
        dbMock.insert(schools).values({ id: schoolId, name: 'Test School' })
        dbMock.insert(users).values({ id: userId, role: 'SCHOOL_ADMIN', schoolId, name: 'Admin User' })
        dbMock.insert(clinicalSites).values({ id: clinicalSiteId, schoolId, name: 'Test Site', type: 'HOSPITAL', address: '123 Main St', phone: '555-0123', email: 'site@test.com', capacity: 10 })

        // Mock getCurrentUser
        vi.mocked(getCurrentUserMock).mockResolvedValue({
            id: userId,
            email: 'admin@test.com',
            name: 'Admin User',
            role: 'SCHOOL_ADMIN',
            schoolId: 'school_123',
            isActive: true,
            onboardingCompleted: true
        })

        const newFacility = {
            facilityName: 'Test Clinic',
            facilityType: 'hospital',
            clinicalSiteId: clinicalSiteId,
            address: '123 Medical Dr',
            latitude: 34.0522,
            longitude: -118.2437,
            geofenceRadius: 300,
            strictGeofence: true,
            contactInfo: {
                name: 'Dr. Smith',
                email: 'smith@test.com',
                phone: '555-0199'
            },
            notes: 'Test notes'
        }

        const req = new NextRequest('http://localhost:3000/api/facility-management', {
            method: 'POST',
            body: JSON.stringify(newFacility)
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.facility.facilityName).toBe(newFacility.facilityName)
        expect(data.data.facility.strictGeofence).toBe(true)
        expect(data.data.facility.clinicalSiteId).toBeDefined()

        // Verify syncing to clinical_site_locations
        const siteLocations = dbMock.getAll('clinical_site_locations')
        expect(siteLocations.length).toBeGreaterThan(0)
        const location = siteLocations.find(l => l.clinicalSiteId === data.data.facility.clinicalSiteId)
        expect(location).toBeDefined()
        expect(location.strictGeofence).toBe(true)
        expect(location.radius).toBe(300)
    })

    it('should update an existing facility', async () => {
        const userId = 'admin_123'
        const facilityId = 'fac_123'
        const clinicalSiteId = 'site_123'
        const schoolId = 'school_123'

        const initialFacility = {
            id: facilityId,
            facilityName: 'Old Clinic',
            schoolId: schoolId,
            clinicalSiteId: clinicalSiteId,
            geofenceRadius: 100,
            strictGeofence: false
        }

        const initialLocation = {
            id: 'loc_123',
            clinicalSiteId: clinicalSiteId,
            radius: 100,
            strictGeofence: false
        }

        // Seed DB
        // Seed DB
        console.log('Seeding schools...')
        console.log('Schools object keys:', Object.keys(schools))
        console.log('dbMock keys:', Object.keys(dbMock))
        console.log('dbMock prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(dbMock)))
        console.log('dbMock.insert is:', dbMock.insert)

        try {
            dbMock.insert(schools).values({ id: schoolId, name: 'Test School' })
            console.log('Schools seeded successfully.')
        } catch (e) {
            console.error('Insert failed:', e)
        }
        dbMock.insert(facilityManagement).values(initialFacility)
        dbMock.insert(clinicalSiteLocations).values(initialLocation)

        // Mock getCurrentUser
        vi.mocked(getCurrentUserMock).mockResolvedValue({
            id: userId,
            email: 'admin@test.com',
            name: 'Admin User',
            role: 'SCHOOL_ADMIN',
            schoolId: schoolId,
            isActive: true,
            onboardingCompleted: true
        })

        const updateData = {
            id: facilityId,
            facilityName: 'Updated Clinic',
            geofenceRadius: 500,
            strictGeofence: true
        }

        const req = new NextRequest(`http://localhost:3000/api/facility-management/${facilityId}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        })

        const response = await PUT(req)
        const data = await response.json()

        if (response.status !== 200) {
            console.log('Facility Management PUT Error:', JSON.stringify(data, null, 2));
        }

        expect(response.status).toBe(200)
        expect(data.data.facility.facilityName).toBe('Updated Clinic')
        expect(data.data.facility.strictGeofence).toBe(true)

        // Verify syncing
        const location = dbMock.getAll('clinical_site_locations').find(l => l.clinicalSiteId === clinicalSiteId)
        expect(location.radius).toBe(500)
        expect(location.strictGeofence).toBe(true)
    })
})
