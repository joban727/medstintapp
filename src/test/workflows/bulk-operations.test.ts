
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { competencyBulkOps } from '@/lib/bulk-operations';
import { batchOperations } from '@/lib/batch-processor';
import { analyticsTransactionBatcher } from '@/lib/transaction-batcher';

// Mock dependencies
vi.mock('@/lib/batch-processor', () => ({
    BatchProcessor: vi.fn(),
    batchOperations: {
        batchInsert: vi.fn(),
        batchUpdate: vi.fn(),
        batchUpsert: vi.fn(),
    }
}));

vi.mock('@/lib/transaction-batcher', () => ({
    analyticsTransactionBatcher: {
        addOperation: vi.fn((op) => op({
            insert: vi.fn().mockReturnValue({
                values: vi.fn().mockReturnValue({
                    returning: vi.fn().mockResolvedValue([])
                })
            })
        })),
    }
}));

vi.mock('@/database/connection-pool', () => ({
    db: {
        execute: vi.fn(),
    }
}));

describe('Competency Bulk Operations', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should bulk assign competencies', async () => {
        const assignments = [
            {
                userId: 'user-1',
                competencyId: 'comp-1',
                programId: 'prog-1',
                assignedBy: 'admin-1'
            },
            {
                userId: 'user-2',
                competencyId: 'comp-1',
                programId: 'prog-1',
                assignedBy: 'admin-1'
            }
        ];

        // Mock batch insert success
        vi.mocked(batchOperations.batchInsert).mockResolvedValue({
            success: true,
            processedCount: 2,
            failedCount: 0,
            results: assignments,
            errors: []
        } as any);

        const result = await competencyBulkOps.bulkAssignCompetencies(assignments);

        expect(result.success).toBe(true);
        expect(result.processedCount).toBe(2);
        expect(batchOperations.batchInsert).toHaveBeenCalledTimes(1);
        // Verify audit logs were created (via analyticsTransactionBatcher)
        expect(analyticsTransactionBatcher.addOperation).toHaveBeenCalledTimes(2);
    });

    it('should bulk create evaluations and update assignment status', async () => {
        const evaluations = [
            {
                assignmentId: 'assign-1',
                evaluatorId: 'preceptor-1',
                score: 5,
                status: 'completed' as const,
                evaluationDate: new Date()
            },
            {
                assignmentId: 'assign-2',
                evaluatorId: 'preceptor-1',
                score: 3,
                status: 'in_progress' as const,
                evaluationDate: new Date()
            }
        ];

        // Mock batch insert for evaluations
        vi.mocked(batchOperations.batchInsert).mockResolvedValue({
            success: true,
            processedCount: 2,
            failedCount: 0,
            results: evaluations,
            errors: []
        } as any);

        // Mock batch update for assignments
        vi.mocked(batchOperations.batchUpdate).mockResolvedValue({
            success: true,
            processedCount: 2,
            failedCount: 0,
            results: [],
            errors: []
        } as any);

        const result = await competencyBulkOps.bulkCreateEvaluations(evaluations);

        expect(result.success).toBe(true);
        expect(batchOperations.batchInsert).toHaveBeenCalledTimes(1); // Insert evaluations
        expect(batchOperations.batchUpdate).toHaveBeenCalledTimes(1); // Update assignment status

        // Verify status mapping
        const updateCall = vi.mocked(batchOperations.batchUpdate).mock.calls[0];
        const updates = updateCall[1] as any[];
        expect(updates[0].set.status).toBe('COMPLETED');
        expect(updates[1].set.status).toBe('IN_PROGRESS');
    });

    it('should bulk update progress', async () => {
        const updates = [
            {
                assignmentId: 'assign-1',
                progress: 50,
                status: 'IN_PROGRESS'
            },
            {
                assignmentId: 'assign-2',
                progress: 100,
                status: 'COMPLETED'
            }
        ];

        vi.mocked(batchOperations.batchUpdate).mockResolvedValue({
            success: true,
            processedCount: 2,
            failedCount: 0,
            results: [],
            errors: []
        } as any);

        const result = await competencyBulkOps.bulkUpdateProgress(updates);

        expect(result.success).toBe(true);
        expect(batchOperations.batchUpdate).toHaveBeenCalledWith(
            expect.anything(), // table
            expect.arrayContaining([
                expect.objectContaining({
                    set: expect.objectContaining({
                        progress: 50,
                        status: 'IN_PROGRESS'
                    })
                }),
                expect.objectContaining({
                    set: expect.objectContaining({
                        progress: 100,
                        status: 'COMPLETED'
                    })
                })
            ])
        );
    });
});
