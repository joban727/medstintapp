import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dbMock } from '../mocks/stateful-db'
import * as schema from '@/database/schema'
import { POST, PUT, DELETE } from '@/app/api/rotations/route'
import { NextRequest } from 'next/server'

// Mock DB
vi.mock('@/database/connection-pool', () => ({
    db: {
        insert: (table: any) => dbMock.insert(table),
        select: (fields: any) => dbMock.select(fields),
        update: (table: any) => dbMock.update(table),
        delete: (table: any) => dbMock.delete(table),
        query: {
            users: {
                findFirst: (args: any) => {
                    const allUsers = dbMock.getAll('users')
                    if (args?.where) return Promise.resolve(allUsers[0])
                    return Promise.resolve(null)
                }
            }
        }
    }
}))

// Mock School Context
const mockContext = {
    userId: 'admin-user',
    schoolId: 'school-123',
    userRole: 'SCHOOL_ADMIN'
}

vi.mock('@/lib/school-utils', () => ({
    getSchoolContext: vi.fn(() => Promise.resolve(mockContext))
}))

vi.mock('@/lib/csrf-middleware', () => ({
    withCSRF: (handler: any) => handler
}))

// Helper to create requests
function createRequest(method: string, body?: any, searchParams?: Record<string, string>) {
    let url = 'http://localhost/api/rotations'
    if (searchParams) {
        const params = new URLSearchParams(searchParams)
        url += `?${params.toString()}`
    }

    return new NextRequest(url, {
        method,
        body: body ? JSON.stringify(body) : undefined,
    })
}

describe('Rotation Management Workflow', () => {
    beforeEach(() => {
        dbMock.reset()
        dbMock.registerTable(schema.users, 'users')
        dbMock.registerTable(schema.clinicalSites, 'clinicalSites')
        dbMock.registerTable(schema.rotations, 'rotations')

        // Setup basic data
        dbMock.insert(schema.users).values({
            id: 'student-1',
            name: 'Student One',
            role: 'STUDENT',
            schoolId: 'school-123'
        }).returning()

        dbMock.insert(schema.users).values({
            id: 'preceptor-1',
            name: 'Dr. Preceptor',
            role: 'CLINICAL_PRECEPTOR',
            schoolId: 'school-123'
        }).returning()

        dbMock.insert(schema.clinicalSites).values({
            id: 'site-1',
            name: 'General Hospital',
            schoolId: 'school-123'
        }).returning()
    })

    it('creates a rotation successfully as Admin', async () => {
        const body = {
            studentId: 'student-1',
            clinicalSiteId: 'site-1',
            preceptorId: 'preceptor-1',
            specialty: 'Internal Medicine',
            startDate: '2024-01-01T00:00:00Z',
            endDate: '2024-02-01T00:00:00Z',
            requiredHours: 160,
            objectives: ['Learn basics']
        }

        const req = createRequest('POST', body)
        const res = await POST(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data.specialty).toBe('Internal Medicine')
        expect(data.data.status).toBe('SCHEDULED')

        // Verify DB
        const rotations = dbMock.getAll('rotations')
        expect(rotations).toHaveLength(1)
        expect(rotations[0].studentId).toBe('student-1')
    })

    it('fails to create rotation with invalid dates', async () => {
        const body = {
            studentId: 'student-1',
            clinicalSiteId: 'site-1',
            specialty: 'Surgery',
            startDate: '2024-02-01T00:00:00Z',
            endDate: '2024-01-01T00:00:00Z', // End before Start
        }

        const req = createRequest('POST', body)
        const res = await POST(req)

        expect(res.status).toBe(400)
    })

    it('updates a rotation successfully', async () => {
        // Create initial rotation
        const [rotation] = await dbMock.insert(schema.rotations).values({
            id: 'rot-1',
            studentId: 'student-1',
            clinicalSiteId: 'site-1',
            specialty: 'Family Medicine',
            status: 'SCHEDULED',
            startDate: new Date('2024-03-01'),
            endDate: new Date('2024-04-01')
        }).returning()

        const updateBody = {
            id: 'rot-1',
            status: 'ACTIVE',
            specialty: 'Advanced Family Medicine'
        }

        const req = createRequest('PUT', updateBody)
        const res = await PUT(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data.status).toBe('ACTIVE')
        expect(data.data.specialty).toBe('Advanced Family Medicine')

        const updated = dbMock.getById('rotations', 'rot-1')
        expect(updated.status).toBe('ACTIVE')
    })

    it('prevents deleting an active rotation', async () => {
        await dbMock.insert(schema.rotations).values({
            id: 'rot-active',
            studentId: 'student-1',
            clinicalSiteId: 'site-1',
            status: 'ACTIVE', // Cannot delete active
            startDate: new Date(),
            endDate: new Date()
        }).returning()

        const req = createRequest('DELETE', null, { id: 'rot-active' })
        const res = await DELETE(req)

        expect(res.status).toBe(400)

        const remaining = dbMock.getAll('rotations')
        expect(remaining).toHaveLength(1)
    })

    it('deletes a scheduled rotation', async () => {
        await dbMock.insert(schema.rotations).values({
            id: 'rot-scheduled',
            studentId: 'student-1',
            clinicalSiteId: 'site-1',
            status: 'SCHEDULED',
            startDate: new Date(),
            endDate: new Date()
        }).returning()

        const req = createRequest('DELETE', null, { id: 'rot-scheduled' })
        const res = await DELETE(req)

        expect(res.status).toBe(200)

        const remaining = dbMock.getAll('rotations')
        expect(remaining).toHaveLength(0)
    })
})
