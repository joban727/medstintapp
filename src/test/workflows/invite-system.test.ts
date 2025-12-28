import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST as POST_INVITE } from '../../app/api/invitations/route'
import { POST as POST_ACCEPT } from '../../app/api/invitations/accept/route'
import { users, schools, programs, cohorts, invitations } from '@/database/schema'

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
    auth: vi.fn(),
    currentUser: vi.fn(),
}))

// Fix hoisting issue by importing dbMock dynamically inside the factory
vi.mock('@/database/db', async () => {
    const { dbMock } = await import('../mocks/stateful-db')
    return {
        db: dbMock,
    }
})

vi.mock('@/lib/email-service', () => ({
    sendInvitationEmail: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/auth-utils', () => ({
    invalidateUserCache: vi.fn(),
}))

// Mock drizzle-orm operators to return structures compatible with stateful-db.ts
vi.mock('drizzle-orm', async () => {
    const actual = await vi.importActual('drizzle-orm')
    return {
        ...actual,
        eq: (left: any, right: any) => ({ left, right }),
        and: (...args: any[]) => args,
        desc: (col: any) => col,
    }
})

describe('Invite System Workflow', () => {
    let dbMock: any
    let adminUser: any
    let studentUser: any
    let school: any
    let program: any
    let cohort: any

    beforeEach(async () => {
        // Import dbMock here to use it in tests
        const { dbMock: mock } = await import('../mocks/stateful-db')
        dbMock = mock
        dbMock.reset()

        // Register tables
        dbMock.registerTable(users, 'users')
        dbMock.registerTable(schools, 'schools')
        dbMock.registerTable(programs, 'programs')
        dbMock.registerTable(cohorts, 'cohorts')
        dbMock.registerTable(invitations, 'invitations')

        // Setup School Context
        // Note: dbMock.insert returns an array!
        const schoolsResult = await dbMock.insert(schools).values({
            id: 'school-1',
            name: 'Test Medical School',
            slug: 'test-med',
            status: 'ACTIVE'
        })
        school = schoolsResult[0]

        const programsResult = await dbMock.insert(programs).values({
            id: 'prog-1',
            schoolId: school.id,
            name: 'MD Program',
            status: 'ACTIVE'
        })
        program = programsResult[0]

        const cohortsResult = await dbMock.insert(cohorts).values({
            id: 'cohort-1',
            programId: program.id,
            name: 'Class of 2025',
            status: 'ACTIVE',
            startDate: new Date(),
            endDate: new Date()
        })
        cohort = cohortsResult[0]

        // Setup Users
        const adminResult = await dbMock.insert(users).values({
            id: 'admin-1',
            email: 'admin@test.com',
            role: 'SCHOOL_ADMIN',
            schoolId: school.id,
            name: 'Admin User'
        })
        adminUser = adminResult[0]

        const studentResult = await dbMock.insert(users).values({
            id: 'student-1',
            email: 'student@test.com',
            role: 'STUDENT', // Initially unassigned or generic student
            name: 'New Student'
        })
        studentUser = studentResult[0]
    })

    it('should allow School Admin to send invitations', async () => {
        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: adminUser.id } as any)

        const req = new NextRequest('http://localhost:3000/api/invitations', {
            method: 'POST',
            body: JSON.stringify({
                emails: ['new-student@test.com'], // Use NEW email
                programId: program.id,
                cohortId: cohort.id,
                role: 'STUDENT'
            })
        })

        const res = await POST_INVITE(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data.created).toHaveLength(1)
        expect(data.data.created[0].email).toBe('new-student@test.com')
        expect(data.data.created[0].status).toBe('PENDING')

        // Verify DB
        const invites = await dbMock.select().from(invitations)
        expect(invites).toHaveLength(1)
        expect(invites[0].invitedBy).toBe(adminUser.id)
    })

    it('should prevent Students from sending invitations', async () => {
        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: studentUser.id } as any)

        const req = new NextRequest('http://localhost:3000/api/invitations', {
            method: 'POST',
            body: JSON.stringify({
                emails: ['other@test.com'],
                programId: program.id,
                cohortId: cohort.id,
                role: 'STUDENT'
            })
        })

        const res = await POST_INVITE(req)

        expect(res.status).toBe(401) // Or 403 depending on implementation
    })

    it('should allow user to accept valid invitation', async () => {
        // 1. Create Invitation
        const inviteResult = await dbMock.insert(invitations).values({
            id: 'invite-1',
            email: 'student@test.com',
            schoolId: school.id,
            programId: program.id,
            cohortId: cohort.id,
            role: 'STUDENT',
            token: 'valid-token-123',
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 86400000), // Tomorrow
            invitedBy: adminUser.id,
            createdAt: new Date()
        })
        const invite = inviteResult[0]

        // 2. Accept as Student
        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: studentUser.id } as any)

        const req = new NextRequest('http://localhost:3000/api/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({
                token: 'valid-token-123'
            })
        })

        const res = await POST_ACCEPT(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.data.schoolId).toBe(school.id)

        // 3. Verify User Updated
        const updatedUser = (await dbMock.select().from(users)).find((u: any) => u.id === studentUser.id)
        expect(updatedUser.schoolId).toBe(school.id)
        expect(updatedUser.programId).toBe(program.id)
        expect(updatedUser.cohortId).toBe(cohort.id)
        expect(updatedUser.approvalStatus).toBe('APPROVED')

        // 4. Verify Invitation Status
        const updatedInvite = (await dbMock.select().from(invitations)).find((i: any) => i.id === invite.id)
        expect(updatedInvite.status).toBe('ACCEPTED')
    })

    it('should reject acceptance if email does not match', async () => {
        // 1. Create Invitation for DIFFERENT email
        await dbMock.insert(invitations).values({
            id: 'invite-2',
            email: 'other@test.com', // Mismatch
            schoolId: school.id,
            programId: program.id,
            cohortId: cohort.id,
            role: 'STUDENT',
            token: 'token-mismatch',
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 86400000),
            invitedBy: adminUser.id,
            createdAt: new Date()
        })

        // 2. Try to accept as 'student@test.com'
        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: studentUser.id } as any)

        const req = new NextRequest('http://localhost:3000/api/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({
                token: 'token-mismatch'
            })
        })

        const res = await POST_ACCEPT(req)

        expect(res.status).toBe(403)
        const data = await res.json()
        expect(data.error).toContain('different email address')
    })

    it('should reject expired invitations', async () => {
        await dbMock.insert(invitations).values({
            id: 'invite-expired',
            email: 'student@test.com',
            schoolId: school.id,
            programId: program.id,
            cohortId: cohort.id,
            role: 'STUDENT',
            token: 'expired-token',
            status: 'PENDING',
            expiresAt: new Date(Date.now() - 86400000), // Yesterday
            invitedBy: adminUser.id,
            createdAt: new Date()
        })

        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: studentUser.id } as any)

        const req = new NextRequest('http://localhost:3000/api/invitations/accept', {
            method: 'POST',
            body: JSON.stringify({
                token: 'expired-token'
            })
        })

        const res = await POST_ACCEPT(req)
        expect(res.status).toBe(400)

        // Verify status update to EXPIRED
        const invite = (await dbMock.select().from(invitations)).find((i: any) => i.id === 'invite-expired')
        expect(invite.status).toBe('EXPIRED')
    })
})
