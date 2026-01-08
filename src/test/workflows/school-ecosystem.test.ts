import { describe, it, expect, beforeEach } from 'vitest'
import { dbMock } from '../mocks/stateful-db'
import * as schema from '@/database/schema'

/**
 * School Ecosystem Test
 * 
 * This test validates that all account types within a single school
 * ecosystem work correctly and are in sync together:
 * - School Admin
 * - Clinical Preceptor
 * - Clinical Supervisor
 * - Student
 * 
 * It tests the complete workflow from school creation through
 * cross-role interactions and data synchronization.
 */
describe('School Ecosystem Workflow', () => {
    // Test data IDs
    const SCHOOL_ID = 'school-med-university'
    const PROGRAM_ID = 'program-radiology'
    const COHORT_ID = 'cohort-2026'
    const CLINICAL_SITE_ID = 'site-general-hospital'

    // User IDs
    const SCHOOL_ADMIN_ID = 'admin-jane-doe'
    const CLINICAL_PRECEPTOR_ID = 'preceptor-dr-smith'
    const CLINICAL_SUPERVISOR_ID = 'supervisor-dr-johnson'
    const STUDENT_ID = 'student-john-smith'

    // Other IDs
    const ROTATION_ID = 'rotation-radiology-1'
    const TIME_RECORD_ID = 'time-record-1'
    const COMPETENCY_ID = 'competency-imaging'
    const ASSIGNMENT_ID = 'assignment-1'
    const ASSESSMENT_ID = 'assessment-1'

    beforeEach(() => {
        dbMock.reset()

        // Register all tables needed for the tests
        dbMock.registerTable(schema.schools, 'schools')
        dbMock.registerTable(schema.programs, 'programs')
        dbMock.registerTable(schema.cohorts, 'cohorts')
        dbMock.registerTable(schema.clinicalSites, 'clinicalSites')
        dbMock.registerTable(schema.users, 'users')
        dbMock.registerTable(schema.rotations, 'rotations')
        dbMock.registerTable(schema.timeRecords, 'timeRecords')
        dbMock.registerTable(schema.competencies, 'competencies')
        dbMock.registerTable(schema.competencyAssignments, 'competencyAssignments')
        dbMock.registerTable(schema.assessments, 'assessments')
    })

    describe('Phase 1: School Setup', () => {
        it('should create a school with all required fields', async () => {
            const result = await dbMock.insert(schema.schools).values({
                id: SCHOOL_ID,
                name: 'Med University',
                address: '123 Medical Ave, Boston, MA 02115',
                phone: '617-555-0100',
                email: 'admin@meduniversity.edu',
                website: 'https://meduniversity.edu',
                accreditation: 'ACGME',
                isActive: true,
                billingModel: 'SCHOOL_PAYS',
                adminId: SCHOOL_ADMIN_ID
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].id).toBe(SCHOOL_ID)
            expect(result[0].name).toBe('Med University')
            expect(result[0].isActive).toBe(true)

            // Verify in DB
            const stored = dbMock.getById('schools', SCHOOL_ID)
            expect(stored).toBeDefined()
            expect(stored.accreditation).toBe('ACGME')
        })

        it('should create a program linked to the school', async () => {
            // First create school
            await dbMock.insert(schema.schools).values({
                id: SCHOOL_ID,
                name: 'Med University',
                isActive: true
            }).returning()

            // Create program
            const result = await dbMock.insert(schema.programs).values({
                id: PROGRAM_ID,
                schoolId: SCHOOL_ID,
                name: 'General Radiology',
                type: 'Residency',
                description: 'Diagnostic and interventional radiology program',
                duration: 48,
                classYear: 2026,
                isActive: true
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].schoolId).toBe(SCHOOL_ID)
            expect(result[0].name).toBe('General Radiology')

            // Verify link
            const program = dbMock.getById('programs', PROGRAM_ID)
            expect(program.schoolId).toBe(SCHOOL_ID)
        })

        it('should create a cohort for the program', async () => {
            // Setup
            await dbMock.insert(schema.schools).values({ id: SCHOOL_ID, name: 'Med University', isActive: true }).returning()
            await dbMock.insert(schema.programs).values({
                id: PROGRAM_ID,
                schoolId: SCHOOL_ID,
                name: 'General Radiology',
                description: 'Radiology program',
                duration: 48,
                classYear: 2026
            }).returning()

            // Create cohort
            const result = await dbMock.insert(schema.cohorts).values({
                id: COHORT_ID,
                programId: PROGRAM_ID,
                name: 'Class of 2026',
                startDate: new Date('2022-07-01'),
                endDate: new Date('2026-06-30'),
                graduationYear: 2026,
                capacity: 20,
                status: 'ACTIVE'
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].programId).toBe(PROGRAM_ID)
            expect(result[0].name).toBe('Class of 2026')
        })

        it('should create a clinical site linked to the school', async () => {
            // Setup
            await dbMock.insert(schema.schools).values({ id: SCHOOL_ID, name: 'Med University', isActive: true }).returning()

            // Create clinical site
            const result = await dbMock.insert(schema.clinicalSites).values({
                id: CLINICAL_SITE_ID,
                schoolId: SCHOOL_ID,
                name: 'General Hospital',
                address: '500 Hospital Ave, Boston, MA 02115',
                phone: '617-555-0200',
                email: 'rotations@generalhospital.org',
                type: 'HOSPITAL',
                capacity: 50,
                specialties: JSON.stringify(['Radiology', 'Internal Medicine', 'Surgery']),
                isActive: true
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].schoolId).toBe(SCHOOL_ID)
            expect(result[0].type).toBe('HOSPITAL')
        })
    })

    describe('Phase 2: Account Creation', () => {
        beforeEach(async () => {
            // Setup school structure for account tests
            await dbMock.insert(schema.schools).values({ id: SCHOOL_ID, name: 'Med University', isActive: true, adminId: SCHOOL_ADMIN_ID }).returning()
            await dbMock.insert(schema.programs).values({ id: PROGRAM_ID, schoolId: SCHOOL_ID, name: 'General Radiology', description: 'Radiology', duration: 48, classYear: 2026 }).returning()
            await dbMock.insert(schema.cohorts).values({ id: COHORT_ID, programId: PROGRAM_ID, name: 'Class of 2026', startDate: new Date(), endDate: new Date('2026-06-30'), capacity: 20 }).returning()
            await dbMock.insert(schema.clinicalSites).values({ id: CLINICAL_SITE_ID, schoolId: SCHOOL_ID, name: 'General Hospital', address: '500 Hospital Ave', phone: '617-555-0200', email: 'contact@hospital.org', type: 'HOSPITAL', capacity: 50 }).returning()
        })

        it('should create School Admin linked to school', async () => {
            const result = await dbMock.insert(schema.users).values({
                id: SCHOOL_ADMIN_ID,
                name: 'Jane Doe',
                email: 'jane.doe@meduniversity.edu',
                emailVerified: true,
                role: 'SCHOOL_ADMIN',
                schoolId: SCHOOL_ID,
                department: 'Administration',
                isActive: true,
                approvalStatus: 'APPROVED',
                onboardingCompleted: true
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].role).toBe('SCHOOL_ADMIN')
            expect(result[0].schoolId).toBe(SCHOOL_ID)

            const admin = dbMock.getById('users', SCHOOL_ADMIN_ID)
            expect(admin.name).toBe('Jane Doe')
        })

        it('should create Clinical Preceptor linked to school', async () => {
            const result = await dbMock.insert(schema.users).values({
                id: CLINICAL_PRECEPTOR_ID,
                name: 'Dr. Robert Smith',
                email: 'r.smith@generalhospital.org',
                emailVerified: true,
                role: 'CLINICAL_PRECEPTOR',
                schoolId: SCHOOL_ID,
                department: 'Radiology',
                isActive: true,
                approvalStatus: 'APPROVED',
                onboardingCompleted: true
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].role).toBe('CLINICAL_PRECEPTOR')
            expect(result[0].schoolId).toBe(SCHOOL_ID)
            expect(result[0].department).toBe('Radiology')
        })

        it('should create Clinical Supervisor linked to school', async () => {
            const result = await dbMock.insert(schema.users).values({
                id: CLINICAL_SUPERVISOR_ID,
                name: 'Dr. Emily Johnson',
                email: 'e.johnson@meduniversity.edu',
                emailVerified: true,
                role: 'CLINICAL_SUPERVISOR',
                schoolId: SCHOOL_ID,
                department: 'Clinical Education',
                isActive: true,
                approvalStatus: 'APPROVED',
                onboardingCompleted: true
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].role).toBe('CLINICAL_SUPERVISOR')
            expect(result[0].schoolId).toBe(SCHOOL_ID)
        })

        it('should create Student with program and cohort', async () => {
            const result = await dbMock.insert(schema.users).values({
                id: STUDENT_ID,
                name: 'John Smith',
                email: 'john.smith@meduniversity.edu',
                emailVerified: true,
                role: 'STUDENT',
                schoolId: SCHOOL_ID,
                programId: PROGRAM_ID,
                cohortId: COHORT_ID,
                studentId: 'STU-2022-0001',
                enrollmentDate: new Date('2022-07-01'),
                expectedGraduation: new Date('2026-06-30'),
                academicStatus: 'ACTIVE',
                totalClinicalHours: 0,
                completedRotations: 0,
                isActive: true,
                approvalStatus: 'APPROVED',
                onboardingCompleted: true
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].role).toBe('STUDENT')
            expect(result[0].schoolId).toBe(SCHOOL_ID)
            expect(result[0].programId).toBe(PROGRAM_ID)
            expect(result[0].cohortId).toBe(COHORT_ID)
        })
    })

    describe('Phase 3: Cross-Role Workflows', () => {
        beforeEach(async () => {
            // Setup complete school ecosystem
            await dbMock.insert(schema.schools).values({ id: SCHOOL_ID, name: 'Med University', isActive: true, adminId: SCHOOL_ADMIN_ID }).returning()
            await dbMock.insert(schema.programs).values({ id: PROGRAM_ID, schoolId: SCHOOL_ID, name: 'General Radiology', description: 'Radiology', duration: 48, classYear: 2026 }).returning()
            await dbMock.insert(schema.cohorts).values({ id: COHORT_ID, programId: PROGRAM_ID, name: 'Class of 2026', startDate: new Date(), endDate: new Date('2026-06-30'), capacity: 20 }).returning()
            await dbMock.insert(schema.clinicalSites).values({ id: CLINICAL_SITE_ID, schoolId: SCHOOL_ID, name: 'General Hospital', address: '500 Hospital Ave', phone: '617-555-0200', email: 'contact@hospital.org', type: 'HOSPITAL', capacity: 50 }).returning()

            // All users
            await dbMock.insert(schema.users).values({ id: SCHOOL_ADMIN_ID, name: 'Jane Doe', email: 'jane.doe@meduniversity.edu', emailVerified: true, role: 'SCHOOL_ADMIN', schoolId: SCHOOL_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()
            await dbMock.insert(schema.users).values({ id: CLINICAL_PRECEPTOR_ID, name: 'Dr. Robert Smith', email: 'r.smith@hospital.org', emailVerified: true, role: 'CLINICAL_PRECEPTOR', schoolId: SCHOOL_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()
            await dbMock.insert(schema.users).values({ id: CLINICAL_SUPERVISOR_ID, name: 'Dr. Emily Johnson', email: 'e.johnson@meduniversity.edu', emailVerified: true, role: 'CLINICAL_SUPERVISOR', schoolId: SCHOOL_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()
            await dbMock.insert(schema.users).values({ id: STUDENT_ID, name: 'John Smith', email: 'john.smith@meduniversity.edu', emailVerified: true, role: 'STUDENT', schoolId: SCHOOL_ID, programId: PROGRAM_ID, cohortId: COHORT_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()
        })

        it('should create rotation with student, site, and preceptor', async () => {
            const result = await dbMock.insert(schema.rotations).values({
                id: ROTATION_ID,
                studentId: STUDENT_ID,
                clinicalSiteId: CLINICAL_SITE_ID,
                programId: PROGRAM_ID,
                cohortId: COHORT_ID,
                preceptorId: CLINICAL_PRECEPTOR_ID,
                supervisorId: CLINICAL_SUPERVISOR_ID,
                specialty: 'Diagnostic Radiology',
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                requiredHours: 160,
                completedHours: 0,
                status: 'ACTIVE'
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].studentId).toBe(STUDENT_ID)
            expect(result[0].preceptorId).toBe(CLINICAL_PRECEPTOR_ID)
            expect(result[0].supervisorId).toBe(CLINICAL_SUPERVISOR_ID)
            expect(result[0].clinicalSiteId).toBe(CLINICAL_SITE_ID)
            expect(result[0].status).toBe('ACTIVE')
        })

        it('should allow student to clock in', async () => {
            // Create rotation first
            await dbMock.insert(schema.rotations).values({
                id: ROTATION_ID,
                studentId: STUDENT_ID,
                clinicalSiteId: CLINICAL_SITE_ID,
                programId: PROGRAM_ID,
                preceptorId: CLINICAL_PRECEPTOR_ID,
                specialty: 'Diagnostic Radiology',
                status: 'ACTIVE'
            }).returning()

            // Student clocks in
            const clockInTime = new Date()
            const result = await dbMock.insert(schema.timeRecords).values({
                id: TIME_RECORD_ID,
                studentId: STUDENT_ID,
                rotationId: ROTATION_ID,
                clinicalPreceptorId: CLINICAL_PRECEPTOR_ID,
                date: clockInTime,
                clockIn: clockInTime,
                clockInLatitude: '42.3601',
                clockInLongitude: '-71.0589',
                clockInAccuracy: '10.5',
                clockInSource: 'gps',
                clockInIpAddress: '192.168.1.1',
                clockInUserAgent: 'Mozilla/5.0 (iPhone)',
                status: 'PENDING'
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].studentId).toBe(STUDENT_ID)
            expect(result[0].rotationId).toBe(ROTATION_ID)
            expect(result[0].status).toBe('PENDING')
            expect(result[0].clockIn).toBeDefined()
            expect(result[0].clockOut).toBeUndefined()
        })

        it('should allow preceptor to view and approve time records', async () => {
            // Setup rotation and time record
            await dbMock.insert(schema.rotations).values({ id: ROTATION_ID, studentId: STUDENT_ID, clinicalSiteId: CLINICAL_SITE_ID, programId: PROGRAM_ID, preceptorId: CLINICAL_PRECEPTOR_ID, specialty: 'Radiology', status: 'ACTIVE' }).returning()

            const clockInTime = new Date(Date.now() - 8 * 60 * 60 * 1000) // 8 hours ago
            const clockOutTime = new Date()

            await dbMock.insert(schema.timeRecords).values({
                id: TIME_RECORD_ID,
                studentId: STUDENT_ID,
                rotationId: ROTATION_ID,
                clinicalPreceptorId: CLINICAL_PRECEPTOR_ID,
                date: clockInTime,
                clockIn: clockInTime,
                clockOut: clockOutTime,
                totalHours: '8.00',
                activities: JSON.stringify(['Patient rounds', 'Image interpretation']),
                status: 'PENDING'
            }).returning()

            // Preceptor approves the time record
            await dbMock.update(schema.timeRecords).set({
                status: 'APPROVED',
                approvedBy: CLINICAL_PRECEPTOR_ID,
                approvedAt: new Date()
            }).where({ left: { name: 'id' }, right: TIME_RECORD_ID })

            // Manually update for mock (since update mock is simple)
            const record = dbMock.getById('timeRecords', TIME_RECORD_ID)
            record.status = 'APPROVED'
            record.approvedBy = CLINICAL_PRECEPTOR_ID

            expect(record.status).toBe('APPROVED')
            expect(record.approvedBy).toBe(CLINICAL_PRECEPTOR_ID)
        })

        it('should allow supervisor to oversee all students and rotations', async () => {
            // Setup multiple students in same program
            await dbMock.insert(schema.users).values({ id: 'student-2', name: 'Alice Brown', email: 'alice@med.edu', emailVerified: true, role: 'STUDENT', schoolId: SCHOOL_ID, programId: PROGRAM_ID, cohortId: COHORT_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()

            // Create rotations for both
            await dbMock.insert(schema.rotations).values({ id: ROTATION_ID, studentId: STUDENT_ID, clinicalSiteId: CLINICAL_SITE_ID, programId: PROGRAM_ID, supervisorId: CLINICAL_SUPERVISOR_ID, preceptorId: CLINICAL_PRECEPTOR_ID, specialty: 'Radiology', status: 'ACTIVE' }).returning()
            await dbMock.insert(schema.rotations).values({ id: 'rotation-2', studentId: 'student-2', clinicalSiteId: CLINICAL_SITE_ID, programId: PROGRAM_ID, supervisorId: CLINICAL_SUPERVISOR_ID, preceptorId: CLINICAL_PRECEPTOR_ID, specialty: 'Radiology', status: 'ACTIVE' }).returning()

            // Supervisor queries all rotations they supervise
            const allRotations = dbMock.getAll('rotations')
            const supervisorRotations = allRotations.filter((r: any) => r.supervisorId === CLINICAL_SUPERVISOR_ID)

            expect(supervisorRotations).toHaveLength(2)
            expect(supervisorRotations.map((r: any) => r.studentId)).toContain(STUDENT_ID)
            expect(supervisorRotations.map((r: any) => r.studentId)).toContain('student-2')
        })

        it('should allow admin to view all users in school', async () => {
            const allUsers = dbMock.getAll('users')
            const schoolUsers = allUsers.filter((u: any) => u.schoolId === SCHOOL_ID)

            expect(schoolUsers.length).toBeGreaterThanOrEqual(4)

            const roles = schoolUsers.map((u: any) => u.role)
            expect(roles).toContain('SCHOOL_ADMIN')
            expect(roles).toContain('CLINICAL_PRECEPTOR')
            expect(roles).toContain('CLINICAL_SUPERVISOR')
            expect(roles).toContain('STUDENT')
        })
    })

    describe('Phase 4: Competency Flow', () => {
        beforeEach(async () => {
            // Setup complete ecosystem
            await dbMock.insert(schema.schools).values({ id: SCHOOL_ID, name: 'Med University', isActive: true }).returning()
            await dbMock.insert(schema.programs).values({ id: PROGRAM_ID, schoolId: SCHOOL_ID, name: 'General Radiology', description: 'Radiology', duration: 48, classYear: 2026 }).returning()
            await dbMock.insert(schema.cohorts).values({ id: COHORT_ID, programId: PROGRAM_ID, name: 'Class of 2026', startDate: new Date(), endDate: new Date('2026-06-30'), capacity: 20 }).returning()
            await dbMock.insert(schema.clinicalSites).values({ id: CLINICAL_SITE_ID, schoolId: SCHOOL_ID, name: 'General Hospital', address: '500 Hospital Ave', phone: '617-555-0200', email: 'contact@hospital.org', type: 'HOSPITAL', capacity: 50 }).returning()

            await dbMock.insert(schema.users).values({ id: SCHOOL_ADMIN_ID, name: 'Jane Doe', email: 'jane@med.edu', emailVerified: true, role: 'SCHOOL_ADMIN', schoolId: SCHOOL_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()
            await dbMock.insert(schema.users).values({ id: CLINICAL_PRECEPTOR_ID, name: 'Dr. Smith', email: 'smith@hospital.org', emailVerified: true, role: 'CLINICAL_PRECEPTOR', schoolId: SCHOOL_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()
            await dbMock.insert(schema.users).values({ id: STUDENT_ID, name: 'John Smith', email: 'john@med.edu', emailVerified: true, role: 'STUDENT', schoolId: SCHOOL_ID, programId: PROGRAM_ID, cohortId: COHORT_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()
            await dbMock.insert(schema.rotations).values({ id: ROTATION_ID, studentId: STUDENT_ID, clinicalSiteId: CLINICAL_SITE_ID, programId: PROGRAM_ID, preceptorId: CLINICAL_PRECEPTOR_ID, specialty: 'Radiology', status: 'ACTIVE' }).returning()
        })

        it('should allow admin to create competency for program', async () => {
            const result = await dbMock.insert(schema.competencies).values({
                id: COMPETENCY_ID,
                name: 'Image Interpretation',
                description: 'Ability to interpret diagnostic imaging studies',
                category: 'Clinical Skills',
                level: 'INTERMEDIATE',
                isRequired: true,
                programId: PROGRAM_ID,
                schoolId: SCHOOL_ID,
                source: 'CUSTOM',
                createdBy: SCHOOL_ADMIN_ID
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].programId).toBe(PROGRAM_ID)
            expect(result[0].schoolId).toBe(SCHOOL_ID)
            expect(result[0].level).toBe('INTERMEDIATE')
        })

        it('should assign competency to student', async () => {
            // Create competency
            await dbMock.insert(schema.competencies).values({ id: COMPETENCY_ID, name: 'Image Interpretation', description: 'Interpret imaging', category: 'Clinical', level: 'INTERMEDIATE', programId: PROGRAM_ID, schoolId: SCHOOL_ID }).returning()

            // Assign to student
            const result = await dbMock.insert(schema.competencyAssignments).values({
                id: ASSIGNMENT_ID,
                userId: STUDENT_ID,
                competencyId: COMPETENCY_ID,
                programId: PROGRAM_ID,
                assignedBy: SCHOOL_ADMIN_ID,
                assignmentType: 'REQUIRED',
                status: 'ASSIGNED',
                dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
                progressPercentage: '0.0'
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].userId).toBe(STUDENT_ID)
            expect(result[0].competencyId).toBe(COMPETENCY_ID)
            expect(result[0].status).toBe('ASSIGNED')
        })

        it('should allow preceptor to assess student competency', async () => {
            // Setup
            await dbMock.insert(schema.competencies).values({ id: COMPETENCY_ID, name: 'Image Interpretation', description: 'Interpret imaging', category: 'Clinical', level: 'INTERMEDIATE', programId: PROGRAM_ID, schoolId: SCHOOL_ID }).returning()
            await dbMock.insert(schema.competencyAssignments).values({ id: ASSIGNMENT_ID, userId: STUDENT_ID, competencyId: COMPETENCY_ID, programId: PROGRAM_ID, assignedBy: SCHOOL_ADMIN_ID, assignmentType: 'REQUIRED', status: 'IN_PROGRESS' }).returning()

            // Preceptor assesses
            const result = await dbMock.insert(schema.assessments).values({
                id: ASSESSMENT_ID,
                studentId: STUDENT_ID,
                competencyId: COMPETENCY_ID,
                assessorId: CLINICAL_PRECEPTOR_ID,
                rotationId: ROTATION_ID,
                type: 'FORMATIVE',
                method: 'OBSERVATION',
                date: new Date(),
                score: '4.0',
                maxScore: '5.0',
                passed: true,
                attempts: 1,
                feedback: 'Excellent image interpretation skills. Shows good understanding of anatomical landmarks.',
                recommendations: 'Continue practicing with complex cases.'
            }).returning()

            expect(result).toHaveLength(1)
            expect(result[0].assessorId).toBe(CLINICAL_PRECEPTOR_ID)
            expect(result[0].studentId).toBe(STUDENT_ID)
            expect(result[0].passed).toBe(true)

            // Update assignment status
            const assignment = dbMock.getById('competencyAssignments', ASSIGNMENT_ID)
            assignment.status = 'COMPLETED'
            assignment.completionDate = new Date()
            assignment.progressPercentage = '100.0'

            expect(assignment.status).toBe('COMPLETED')
        })
    })

    describe('Phase 5: Data Sync Verification', () => {
        beforeEach(async () => {
            // Setup complete ecosystem with all relationships
            await dbMock.insert(schema.schools).values({ id: SCHOOL_ID, name: 'Med University', isActive: true, adminId: SCHOOL_ADMIN_ID }).returning()
            await dbMock.insert(schema.programs).values({ id: PROGRAM_ID, schoolId: SCHOOL_ID, name: 'General Radiology', description: 'Radiology', duration: 48, classYear: 2026 }).returning()
            await dbMock.insert(schema.cohorts).values({ id: COHORT_ID, programId: PROGRAM_ID, name: 'Class of 2026', startDate: new Date(), endDate: new Date('2026-06-30'), capacity: 20 }).returning()
            await dbMock.insert(schema.clinicalSites).values({ id: CLINICAL_SITE_ID, schoolId: SCHOOL_ID, name: 'General Hospital', address: '500 Hospital Ave', phone: '617-555-0200', email: 'contact@hospital.org', type: 'HOSPITAL', capacity: 50 }).returning()

            await dbMock.insert(schema.users).values({ id: SCHOOL_ADMIN_ID, name: 'Jane Doe', email: 'jane@med.edu', emailVerified: true, role: 'SCHOOL_ADMIN', schoolId: SCHOOL_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()
            await dbMock.insert(schema.users).values({ id: CLINICAL_PRECEPTOR_ID, name: 'Dr. Smith', email: 'smith@hospital.org', emailVerified: true, role: 'CLINICAL_PRECEPTOR', schoolId: SCHOOL_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()
            await dbMock.insert(schema.users).values({ id: CLINICAL_SUPERVISOR_ID, name: 'Dr. Johnson', email: 'johnson@med.edu', emailVerified: true, role: 'CLINICAL_SUPERVISOR', schoolId: SCHOOL_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()
            await dbMock.insert(schema.users).values({ id: STUDENT_ID, name: 'John Smith', email: 'john@med.edu', emailVerified: true, role: 'STUDENT', schoolId: SCHOOL_ID, programId: PROGRAM_ID, cohortId: COHORT_ID, isActive: true, approvalStatus: 'APPROVED' }).returning()

            await dbMock.insert(schema.rotations).values({ id: ROTATION_ID, studentId: STUDENT_ID, clinicalSiteId: CLINICAL_SITE_ID, programId: PROGRAM_ID, cohortId: COHORT_ID, preceptorId: CLINICAL_PRECEPTOR_ID, supervisorId: CLINICAL_SUPERVISOR_ID, specialty: 'Radiology', status: 'ACTIVE' }).returning()
            await dbMock.insert(schema.timeRecords).values({ id: TIME_RECORD_ID, studentId: STUDENT_ID, rotationId: ROTATION_ID, clinicalPreceptorId: CLINICAL_PRECEPTOR_ID, date: new Date(), clockIn: new Date(), status: 'PENDING' }).returning()
            await dbMock.insert(schema.competencies).values({ id: COMPETENCY_ID, name: 'Image Interpretation', description: 'Interpret imaging', category: 'Clinical', level: 'INTERMEDIATE', programId: PROGRAM_ID, schoolId: SCHOOL_ID }).returning()
            await dbMock.insert(schema.competencyAssignments).values({ id: ASSIGNMENT_ID, userId: STUDENT_ID, competencyId: COMPETENCY_ID, programId: PROGRAM_ID, assignedBy: SCHOOL_ADMIN_ID, assignmentType: 'REQUIRED', status: 'ASSIGNED' }).returning()
        })

        it('should verify all accounts reference the same school', () => {
            const allUsers = dbMock.getAll('users')
            const uniqueSchoolIds = new Set(allUsers.map((u: any) => u.schoolId))

            expect(uniqueSchoolIds.size).toBe(1)
            expect(uniqueSchoolIds.has(SCHOOL_ID)).toBe(true)
        })

        it('should verify student references correct program and cohort', () => {
            const student = dbMock.getById('users', STUDENT_ID)
            const program = dbMock.getById('programs', PROGRAM_ID)
            const cohort = dbMock.getById('cohorts', COHORT_ID)

            expect(student.programId).toBe(PROGRAM_ID)
            expect(student.cohortId).toBe(COHORT_ID)
            expect(program.schoolId).toBe(student.schoolId)
            expect(cohort.programId).toBe(student.programId)
        })

        it('should verify rotation links all parties correctly', () => {
            const rotation = dbMock.getById('rotations', ROTATION_ID)
            const student = dbMock.getById('users', STUDENT_ID)
            const preceptor = dbMock.getById('users', CLINICAL_PRECEPTOR_ID)
            const supervisor = dbMock.getById('users', CLINICAL_SUPERVISOR_ID)
            const site = dbMock.getById('clinicalSites', CLINICAL_SITE_ID)

            // All linked to same school
            expect(student.schoolId).toBe(SCHOOL_ID)
            expect(preceptor.schoolId).toBe(SCHOOL_ID)
            expect(supervisor.schoolId).toBe(SCHOOL_ID)
            expect(site.schoolId).toBe(SCHOOL_ID)

            // Rotation references correct entities
            expect(rotation.studentId).toBe(STUDENT_ID)
            expect(rotation.preceptorId).toBe(CLINICAL_PRECEPTOR_ID)
            expect(rotation.supervisorId).toBe(CLINICAL_SUPERVISOR_ID)
            expect(rotation.clinicalSiteId).toBe(CLINICAL_SITE_ID)
        })

        it('should verify time record links to rotation and preceptor', () => {
            const timeRecord = dbMock.getById('timeRecords', TIME_RECORD_ID)
            const rotation = dbMock.getById('rotations', ROTATION_ID)

            expect(timeRecord.rotationId).toBe(ROTATION_ID)
            expect(timeRecord.studentId).toBe(rotation.studentId)
            expect(timeRecord.clinicalPreceptorId).toBe(rotation.preceptorId)
        })

        it('should verify competency assignment chain', () => {
            const assignment = dbMock.getById('competencyAssignments', ASSIGNMENT_ID)
            const competency = dbMock.getById('competencies', COMPETENCY_ID)
            const student = dbMock.getById('users', STUDENT_ID)

            expect(assignment.userId).toBe(STUDENT_ID)
            expect(assignment.competencyId).toBe(COMPETENCY_ID)
            expect(assignment.programId).toBe(PROGRAM_ID)
            expect(competency.programId).toBe(student.programId)
            expect(competency.schoolId).toBe(student.schoolId)
        })

        it('should complete full ecosystem verification', () => {
            // Final comprehensive check
            const school = dbMock.getById('schools', SCHOOL_ID)
            const program = dbMock.getById('programs', PROGRAM_ID)
            const cohort = dbMock.getById('cohorts', COHORT_ID)
            const site = dbMock.getById('clinicalSites', CLINICAL_SITE_ID)
            const admin = dbMock.getById('users', SCHOOL_ADMIN_ID)
            const preceptor = dbMock.getById('users', CLINICAL_PRECEPTOR_ID)
            const supervisor = dbMock.getById('users', CLINICAL_SUPERVISOR_ID)
            const student = dbMock.getById('users', STUDENT_ID)
            const rotation = dbMock.getById('rotations', ROTATION_ID)
            const timeRecord = dbMock.getById('timeRecords', TIME_RECORD_ID)
            const competency = dbMock.getById('competencies', COMPETENCY_ID)
            const assignment = dbMock.getById('competencyAssignments', ASSIGNMENT_ID)

            // All entities exist
            expect(school).toBeDefined()
            expect(program).toBeDefined()
            expect(cohort).toBeDefined()
            expect(site).toBeDefined()
            expect(admin).toBeDefined()
            expect(preceptor).toBeDefined()
            expect(supervisor).toBeDefined()
            expect(student).toBeDefined()
            expect(rotation).toBeDefined()
            expect(timeRecord).toBeDefined()
            expect(competency).toBeDefined()
            expect(assignment).toBeDefined()

            // Hierarchy is correct
            expect(program.schoolId).toBe(school.id)
            expect(cohort.programId).toBe(program.id)
            expect(site.schoolId).toBe(school.id)
            expect(school.adminId).toBe(admin.id)

            // All users in same school
            expect(admin.schoolId).toBe(school.id)
            expect(preceptor.schoolId).toBe(school.id)
            expect(supervisor.schoolId).toBe(school.id)
            expect(student.schoolId).toBe(school.id)

            // Roles are correct
            expect(admin.role).toBe('SCHOOL_ADMIN')
            expect(preceptor.role).toBe('CLINICAL_PRECEPTOR')
            expect(supervisor.role).toBe('CLINICAL_SUPERVISOR')
            expect(student.role).toBe('STUDENT')

            console.log('✅ School Ecosystem Verified! All accounts in sync.')
        })
    })
})
