
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCompetency, updateCompetency, deleteCompetency, getCompetenciesByProgram } from '@/app/actions/competencies';
import { db } from '@/database/connection-pool';
import { getCurrentUser } from '@/lib/auth-clerk';
import { revalidatePath } from 'next/cache';

// Mock dependencies
vi.mock('@/database/connection-pool', () => ({
    db: {
        insert: vi.fn(),
        select: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    }
}));

vi.mock('@/lib/auth-clerk', () => ({
    getCurrentUser: vi.fn()
}));

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn()
}));

vi.mock('uuid', () => ({
    v4: () => 'new-competency-id'
}));

describe('Admin Competency Workflow', () => {
    const mockUser = {
        id: 'admin-user',
        schoolId: 'school-1',
        role: 'SCHOOL_ADMIN'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any);
    });

    it('should create a new competency', async () => {
        const newCompetencyData = {
            name: 'Venipuncture',
            description: 'Perform venipuncture correctly',
            programId: 'program-1',
            category: 'Clinical Skills',
            level: 'FUNDAMENTAL' as const,
            isRequired: true
        };

        // Mock DB insert
        const mockInsertReturn = [{
            id: 'new-competency-id',
            ...newCompetencyData,
            schoolId: mockUser.schoolId,
            createdBy: mockUser.id,
            createdAt: new Date(),
            updatedAt: new Date()
        }];

        vi.mocked(db.insert).mockReturnValue({
            values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue(mockInsertReturn)
            })
        } as any);

        const result = await createCompetency(newCompetencyData);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockInsertReturn[0]);
        expect(db.insert).toHaveBeenCalled();
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/school-admin/programs');
    });

    it('should update an existing competency', async () => {
        const competencyId = 'comp-1';
        const updateData = {
            name: 'Advanced Venipuncture',
            level: 'ADVANCED' as const
        };

        const mockUpdateReturn = [{
            id: competencyId,
            name: updateData.name,
            level: updateData.level,
            updatedAt: new Date()
        }];

        vi.mocked(db.update).mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue(mockUpdateReturn)
                })
            })
        } as any);

        const result = await updateCompetency(competencyId, updateData);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockUpdateReturn[0]);
        expect(db.update).toHaveBeenCalled();
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/school-admin/programs');
    });

    it('should delete a competency if no assignments exist', async () => {
        const competencyId = 'comp-1';

        // Mock check for existing assignments (count = 0)
        vi.mocked(db.select).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ count: 0 }])
            })
        } as any);

        // Mock delete
        vi.mocked(db.delete).mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined)
        } as any);

        const result = await deleteCompetency(competencyId);

        expect(result.success).toBe(true);
        expect(db.delete).toHaveBeenCalled();
        expect(revalidatePath).toHaveBeenCalledWith('/dashboard/school-admin/programs');
    });

    it('should prevent deletion if assignments exist', async () => {
        const competencyId = 'comp-1';

        // Mock check for existing assignments (count > 0)
        vi.mocked(db.select).mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([{ count: 5 }])
            })
        } as any);

        const result = await deleteCompetency(competencyId);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot delete competency');
        expect(db.delete).not.toHaveBeenCalled();
    });
});
