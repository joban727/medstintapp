import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../../app/api/competency-evaluations/route'
import {
    users,
    competencies,
    competencyAssignments,
    evaluations,
    rotations,
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

// Mock competency utils
vi.mock('@/lib/competency-utils', () => ({
    canSubmitCompetencies: vi.fn(),
    validateSubmissionTarget: vi.fn(),
    updateAssignmentProgress: vi.fn().mockResolvedValue(undefined),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// Mock CSRF middleware
vi.mock('@/lib/csrf-middleware', () => ({
    withCSRF: (handler: any) => handler,
}))

describe('Competency Evaluation Workflow', () => {
    let dbMock: any
    let preceptorUser: any
    let studentUser: any
    let school: any
    let rotation: any
    let competency: any
    let assignment: any

    beforeEach(async () => {
        // Import dbMock here to use it in tests
        const { dbMock: mock } = await import('../mocks/stateful-db')
        dbMock = mock
        dbMock.reset()

        // Register tables
        dbMock.registerTable(users, 'users')
        dbMock.registerTable(schools, 'schools')
        dbMock.registerTable(rotations, 'rotations')
        dbMock.registerTable(competencies, 'competencies')
        dbMock.registerTable(competencyAssignments, 'competency_assignments')
        dbMock.registerTable(evaluations, 'evaluations')

        // Setup School
        const schoolsResult = await dbMock.insert(schools).values({
            id: 'school-1',
            name: 'Test Medical School',
            slug: 'test-med',
            status: 'ACTIVE'
        })
        school = schoolsResult[0]

        // Setup Users
        const preceptorResult = await dbMock.insert(users).values({
            id: 'preceptor-1',
            email: 'preceptor@test.com',
            role: 'CLINICAL_PRECEPTOR',
            schoolId: school.id,
            name: 'Dr. Preceptor'
        })
        preceptorUser = preceptorResult[0]

        const studentResult = await dbMock.insert(users).values({
            id: 'student-1',
            email: 'student@test.com',
            role: 'STUDENT',
            schoolId: school.id,
            name: 'Student User'
        })
        studentUser = studentResult[0]

        // Setup Rotation
        const rotationResult = await dbMock.insert(rotations).values({
            id: 'rotation-1',
            studentId: studentUser.id,
            specialty: 'Internal Medicine',
            startDate: new Date(),
            endDate: new Date(Date.now() + 86400000), // Tomorrow
            status: 'ACTIVE'
        })
        rotation = rotationResult[0]

        // Setup Competency
        const competencyResult = await dbMock.insert(competencies).values({
            id: 'comp-1',
            name: 'Physical Exam',
            description: 'Perform a physical exam',
            category: 'Clinical Skills',
            level: 'INTERMEDIATE'
        })
        competency = competencyResult[0]

        // Setup Assignment
        const assignmentResult = await dbMock.insert(competencyAssignments).values({
            id: 'assign-1',
            userId: studentUser.id,
            competencyId: competency.id,
            assignedBy: preceptorUser.id,
            assignmentType: 'REQUIRED',
            status: 'ASSIGNED',
            progressPercentage: '0'
        })
        assignment = assignmentResult[0]
    })

    it('should allow Clinical Preceptor to submit evaluation', async () => {
        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: preceptorUser.id } as any)

        const { canSubmitCompetencies, validateSubmissionTarget } = await import('@/lib/competency-utils')
        vi.mocked(canSubmitCompetencies).mockReturnValue(true)
        vi.mocked(validateSubmissionTarget).mockReturnValue(true)

        const req = new NextRequest('http://localhost:3000/api/competency-evaluations', {
            method: 'POST',
            body: JSON.stringify({
                assignmentId: assignment.id,
                evaluatorId: preceptorUser.id,
                criterionScores: { "criteria-1": 5 },
                overallScore: 5,
                feedback: "Excellent work",
                status: "approved",
                recommendations: "Keep it up",
                evaluationDate: new Date().toISOString()
            })
        })

        const res = await POST(req)
        const data = await res.json()

        expect(res.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.evaluationId).toBeDefined()

        // Verify DB
        const evals = await dbMock.select().from(evaluations)
        expect(evals).toHaveLength(1)
        expect(evals[0].assignmentId).toBe(assignment.id)
        expect(evals[0].evaluatorId).toBe(preceptorUser.id)
        expect(evals[0].rotationId).toBe(rotation.id)

        // Verify Utils called
        const { updateAssignmentProgress, createAuditLog } = await import('@/lib/competency-utils')
        expect(updateAssignmentProgress).toHaveBeenCalledWith(studentUser.id, competency.id, 'completed')
        expect(createAuditLog).toHaveBeenCalled()
    })

    it('should fail if student has no active rotation', async () => {
        // Remove rotation
        dbMock.reset() // Reset clears everything
        // Re-setup without rotation... actually easier to just delete from state or not insert it.
        // But beforeEach runs every time.
        // I'll manually "delete" the rotation from the mock state for this test, 
        // assuming dbMock exposes state or I can just not insert it if I refactor beforeEach.
        // Since I can't easily modify beforeEach, I'll just use a new student/assignment for this test case if possible,
        // or just accept that I need to mock the DB response for this specific test if I wasn't using a stateful mock.
        // But with stateful mock, I can just not insert it? No, beforeEach inserts it.
        // I can try to delete it? dbMock doesn't have delete exposed easily in the interface I saw.
        // Wait, dbMock has `update` but not `delete`?
        // I'll check `stateful-db.ts` again. It has `insert`, `select`, `update`. No `delete`.
        // So I can't delete the rotation.
        // I will create a NEW student and assignment who has NO rotation.

        // Re-insert preceptor user since reset() cleared it
        await dbMock.insert(users).values({
            id: preceptorUser.id,
            email: preceptorUser.email,
            role: preceptorUser.role,
            schoolId: school.id,
            name: preceptorUser.name
        })

        const studentNoRotResult = await dbMock.insert(users).values({
            id: 'student-no-rot',
            email: 'norot@test.com',
            role: 'STUDENT',
            schoolId: school.id,
            name: 'No Rotation Student'
        })
        const studentNoRot = studentNoRotResult[0]

        const assignmentNoRotResult = await dbMock.insert(competencyAssignments).values({
            id: 'assign-no-rot',
            userId: studentNoRot.id,
            competencyId: competency.id,
            assignedBy: preceptorUser.id,
            assignmentType: 'REQUIRED',
            status: 'ASSIGNED'
        })
        const assignmentNoRot = assignmentNoRotResult[0]

        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: preceptorUser.id } as any)

        const { canSubmitCompetencies, validateSubmissionTarget } = await import('@/lib/competency-utils')
        vi.mocked(canSubmitCompetencies).mockReturnValue(true)
        vi.mocked(validateSubmissionTarget).mockReturnValue(true)

        const req = new NextRequest('http://localhost:3000/api/competency-evaluations', {
            method: 'POST',
            body: JSON.stringify({
                assignmentId: assignmentNoRot.id,
                evaluatorId: preceptorUser.id,
                criterionScores: { "criteria-1": 5 },
                overallScore: 5,
                feedback: "Good",
                status: "approved"
            })
        })

        const res = await POST(req)
        const data = await res.json()

        expect(res.status).toBe(400)
        expect(data.error).toContain('must be assigned to a rotation')
    })

    it('should forbid unauthorized users', async () => {
        const { auth } = await import('@clerk/nextjs/server')
        vi.mocked(auth).mockResolvedValue({ userId: studentUser.id } as any) // Student trying to submit

        // Even if canSubmitCompetencies returns true (mocked), the route checks user role from DB too?
        // The route fetches user from DB and calls canSubmitCompetencies with user.role.
        // So I need to make sure canSubmitCompetencies returns false for STUDENT.
        const { canSubmitCompetencies } = await import('@/lib/competency-utils')
        vi.mocked(canSubmitCompetencies).mockReturnValue(false)

        const req = new NextRequest('http://localhost:3000/api/competency-evaluations', {
            method: 'POST',
            body: JSON.stringify({
                assignmentId: assignment.id,
                evaluatorId: studentUser.id,
                criterionScores: {},
                overallScore: 5,
                status: "approved"
            })
        })

        const res = await POST(req)
        expect(res.status).toBe(403)
    })
})
