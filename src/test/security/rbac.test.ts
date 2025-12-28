import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/invitations/route'
import { users, schools } from '@/database/schema'

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
    auth: vi.fn(),
    currentUser: vi.fn(),
}))

vi.mock('@/database/db', async () => {
    const { dbMock } = await import('../mocks/stateful-db')
    return {
        db: dbMock,
    }
})

describe('RBAC Enforcement', () => {
    let dbMock: any
    let studentUser: any
    let school: any

    beforeEach(async () => {
        const { dbMock: mock } = await import('../mocks/stateful-db')
        dbMock = mock
        dbMock.reset()

        // Register tables
        dbMock.registerTable(users, 'users')
        dbMock.registerTable(schools, 'schools')

        // Setup Data
        const schoolsResult = await dbMock.insert(schools).values({
            id: 'school-1',
            name: 'Test School',
            slug: 'test-school',
            status: 'ACTIVE'
        })
        school = schoolsResult[0]

        const studentResult = await dbMock.insert(users).values({
            id: 'student-1',
            email: 'student@test.com',
            role: 'STUDENT',
            schoolId: school.id,
            name: 'Student User'
        })
        studentUser = studentResult[0]
    })

    it('should prevent STUDENT from accessing SCHOOL_ADMIN routes', async () => {
        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: studentUser.id } as any)

        const req = new NextRequest('http://localhost:3000/api/invitations', {
            method: 'POST',
            body: JSON.stringify({
                emails: ['new@test.com'],
                programId: 'prog-1',
                cohortId: 'cohort-1',
                role: 'STUDENT'
            })
        })

        const res = await POST(req)

        // Expect 401 or 403. 
        // If the handler checks role and returns 401 for unauthorized role, that's fine too.
        expect([401, 403]).toContain(res.status)
    })
})
