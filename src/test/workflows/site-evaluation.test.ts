import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST, GET } from '../../app/api/evaluations/site/route'
import {
    users,
    rotations,
    siteEvaluations,
    clinicalSites,
    schools
} from '@/database/schema'

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
    auth: vi.fn(),
}))

// Mock database
vi.mock('@/database/connection-pool', async () => {
    const { dbMock } = await import('../mocks/stateful-db')
    return {
        db: dbMock,
    }
})

// Mock CSRF middleware
vi.mock('@/lib/csrf-middleware', () => ({
    withCSRF: (handler: any) => handler,
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
    auditLogger: {
        log: vi.fn().mockResolvedValue(undefined),
    }
}))

describe('Site Evaluation Workflow', () => {
    let dbMock: any
    let studentUser: any
    let school: any
    let clinicalSite: any
    let rotation: any

    beforeEach(async () => {
        const { dbMock: mock } = await import('../mocks/stateful-db')
        dbMock = mock
        dbMock.reset()

        // Register tables
        dbMock.registerTable(users, 'users')
        dbMock.registerTable(schools, 'schools')
        dbMock.registerTable(clinicalSites, 'clinical_sites')
        dbMock.registerTable(rotations, 'rotations')
        dbMock.registerTable(siteEvaluations, 'site_evaluations')

        // Setup School
        const schoolsResult = await dbMock.insert(schools).values({
            id: 'school-1',
            name: 'Test Medical School',
            isActive: true
        })
        school = schoolsResult[0]

        // Setup Student
        const studentResult = await dbMock.insert(users).values({
            id: 'student-1',
            email: 'student@test.com',
            role: 'STUDENT',
            schoolId: school.id,
            name: 'Student User'
        })
        studentUser = studentResult[0]

        // Setup Clinical Site
        const siteResult = await dbMock.insert(clinicalSites).values({
            id: 'site-1',
            name: 'Test Hospital',
            address: '123 Test St',
            phone: '555-0123',
            email: 'hospital@test.com',
            type: 'HOSPITAL',
            capacity: 10,
            isActive: true
        })
        clinicalSite = siteResult[0]

        // Setup Rotation
        const rotationResult = await dbMock.insert(rotations).values({
            id: 'rotation-1',
            studentId: studentUser.id,
            clinicalSiteId: clinicalSite.id,
            specialty: 'Internal Medicine',
            startDate: new Date(),
            endDate: new Date(Date.now() + 86400000),
            status: 'ACTIVE'
        })
        rotation = rotationResult[0]
    })

    it('should successfully submit a site evaluation', async () => {
        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: studentUser.id } as any)

        const req = new NextRequest('http://localhost:3000/api/evaluations/site', {
            method: 'POST',
            body: JSON.stringify({
                rotationId: rotation.id,
                clinicalSiteId: clinicalSite.id,
                rating: 5,
                feedback: 'Great learning environment',
                learningOpportunitiesRating: 5,
                preceptorSupportRating: 4,
                facilityQualityRating: 5,
                recommendToOthers: true,
                isAnonymous: false
            })
        })

        const res = await POST(req)
        const data = await res.json()

        expect(res.status).toBe(201)
        expect(data.success).toBe(true)
        expect(data.data.evaluation).toBeDefined()

        // Verify DB
        const evals = await dbMock.select().from(siteEvaluations)
        expect(evals).toHaveLength(1)
        expect(evals[0].rotationId).toBe(rotation.id)
        expect(evals[0].studentId).toBe(studentUser.id)
    })

    it('should prevent duplicate evaluations for the same rotation', async () => {
        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: studentUser.id } as any)

        // Insert first evaluation
        await dbMock.insert(siteEvaluations).values({
            id: 'eval-1',
            studentId: studentUser.id,
            rotationId: rotation.id,
            clinicalSiteId: clinicalSite.id,
            rating: 4
        })

        const req = new NextRequest('http://localhost:3000/api/evaluations/site', {
            method: 'POST',
            body: JSON.stringify({
                rotationId: rotation.id,
                clinicalSiteId: clinicalSite.id,
                rating: 5
            })
        })

        const res = await POST(req)
        const data = await res.json()

        expect(res.status).toBe(409)
        expect(data.error).toBe('Evaluation already submitted for this rotation')
    })

    it('should fail if rotation does not belong to student', async () => {
        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: 'other-student' } as any)

        const req = new NextRequest('http://localhost:3000/api/evaluations/site', {
            method: 'POST',
            body: JSON.stringify({
                rotationId: rotation.id,
                clinicalSiteId: clinicalSite.id,
                rating: 5
            })
        })

        const res = await POST(req)
        const data = await res.json()

        expect(res.status).toBe(404)
        expect(data.error).toBe('Rotation not found or does not belong to you')
    })

    it('should allow admins to fetch all evaluations', async () => {
        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({
            userId: 'admin-1',
            sessionClaims: { metadata: { role: 'SCHOOL_ADMIN' } }
        } as any)

        // Insert an evaluation
        await dbMock.insert(siteEvaluations).values({
            id: 'eval-1',
            studentId: studentUser.id,
            rotationId: rotation.id,
            clinicalSiteId: clinicalSite.id,
            rating: 4
        })

        const req = new NextRequest('http://localhost:3000/api/evaluations/site', {
            method: 'GET'
        })

        const res = await GET(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.data.evaluations).toHaveLength(1)
    })
})
