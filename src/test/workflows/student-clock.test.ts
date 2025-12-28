
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/time-records/clock/route';
import { db } from '@/database/connection-pool';
import { getSchoolContext } from '@/lib/school-utils';
import { ClockService } from '@/lib/clock-service';
import { clockOperationLimiter } from '@/lib/rate-limiter';

// Mock dependencies
vi.mock('@/database/connection-pool', () => ({
    db: {
        select: vi.fn(),
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
    }
}));

vi.mock('@/lib/school-utils', () => ({
    getSchoolContext: vi.fn()
}));

vi.mock('@/lib/clock-service', () => ({
    ClockService: {
        clockIn: vi.fn(),
        clockOut: vi.fn(),
        getClockStatus: vi.fn(),
    }
}));

vi.mock('@/lib/rate-limiter', () => ({
    clockOperationLimiter: {
        checkLimit: vi.fn().mockResolvedValue({ allowed: true })
    }
}));

vi.mock('@/lib/cache-integration', () => ({
    cacheIntegrationService: {
        invalidateByTags: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
    }
}));

vi.mock('@/lib/logger', () => ({
    logger: {
        error: vi.fn(),
        info: vi.fn(),
    }
}));

describe('Student Clock System', () => {
    const mockStudent = {
        userId: 'student-1',
        userRole: 'STUDENT',
        schoolId: 'school-1'
    };

    const ROTATION_ID = '123e4567-e89b-12d3-a456-426614174000';
    const RECORD_ID = '123e4567-e89b-12d3-a456-426614174001';

    const mockRotation = {
        id: ROTATION_ID,
        studentId: 'student-1',
        clinicalSiteId: 'site-1'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getSchoolContext).mockResolvedValue(mockStudent as any);
        vi.mocked(clockOperationLimiter.checkLimit).mockResolvedValue({ allowed: true } as any);
    });

    describe('Clock In', () => {
        it('should successfully clock in with valid data and location', async () => {
            // Mock DB with sequential returns at the limit() call
            const limitMock = vi.fn()
                .mockResolvedValueOnce([mockRotation]) // First call: Get rotation
                .mockResolvedValueOnce([{              // Second call: Get new record
                    id: RECORD_ID,
                    studentId: 'student-1',
                    rotationId: ROTATION_ID,
                    clockIn: new Date(),
                    status: 'active'
                }]);

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: limitMock
                    })
                })
            } as any);

            // Mock ClockService success
            vi.mocked(ClockService.clockIn).mockResolvedValue({
                recordId: RECORD_ID,
                timeValidation: { warnings: [] }
            } as any);

            const req = new NextRequest('http://localhost:3000/api/time-records/clock', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'clock-in',
                    rotationId: ROTATION_ID,
                    latitude: 34.0522,
                    longitude: -118.2437,
                    accuracy: 10
                })
            });

            const res = await POST(req);
            const data = await res.json();
            if (res.status !== 200) console.log('Clock In Error:', data);

            expect(res.status).toBe(200);
            expect(data.success).toBe(true);
            expect(ClockService.clockIn).toHaveBeenCalledWith(expect.objectContaining({
                location: {
                    latitude: 34.0522,
                    longitude: -118.2437,
                    accuracy: 10
                }
            }));
        });

        it('should fail if student is already clocked in', async () => {
            // Mock DB to return rotation
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([mockRotation])
                    })
                })
            } as any);

            vi.mocked(ClockService.clockIn).mockRejectedValue(new Error('Student is already clocked in'));

            const req = new NextRequest('http://localhost:3000/api/time-records/clock', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'clock-in',
                    rotationId: ROTATION_ID
                })
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(409);
            expect(data.error).toBe('Student is already clocked in');
        });

        it('should handle edge case: clock in with poor location accuracy', async () => {
            // Mock DB with sequential returns at the limit() call
            const limitMock = vi.fn()
                .mockResolvedValueOnce([mockRotation]) // First call: Get rotation
                .mockResolvedValueOnce([{              // Second call: Get new record
                    id: RECORD_ID,
                    studentId: 'student-1',
                    rotationId: ROTATION_ID,
                    clockIn: new Date(),
                    status: 'active'
                }]);

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: limitMock
                    })
                })
            } as any);

            // Mock ClockService to return warning
            vi.mocked(ClockService.clockIn).mockResolvedValue({
                recordId: RECORD_ID,
                timeValidation: { warnings: ['Location accuracy is low'] }
            } as any);

            const req = new NextRequest('http://localhost:3000/api/time-records/clock', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'clock-in',
                    rotationId: ROTATION_ID,
                    latitude: 34.0522,
                    longitude: -118.2437,
                    accuracy: 500 // Poor accuracy
                })
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.data.validationWarnings).toContain('Location accuracy is low');
        });

        it('should flag clock-in when outside geofence', async () => {
            // Mock DB to return rotation
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([mockRotation])
                    })
                })
            } as any);

            // Mock ClockService to return geofence warning
            vi.mocked(ClockService.clockIn).mockResolvedValue({
                recordId: RECORD_ID,
                timeValidation: { warnings: ['Geofence validation failed - Too far from site'] }
            } as any);

            const req = new NextRequest('http://localhost:3000/api/time-records/clock', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'clock-in',
                    rotationId: ROTATION_ID,
                    latitude: 34.0000, // Far away
                    longitude: -118.0000,
                    accuracy: 10
                })
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(200);
            expect(data.data.validationWarnings).toContain('Geofence validation failed - Too far from site');
        });

        it('should reject clock-in when outside geofence in STRICT mode', async () => {
            // Mock DB to return rotation
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([mockRotation])
                    })
                })
            } as any);

            // Mock ClockService to throw validation error (simulating strict mode)
            vi.mocked(ClockService.clockIn).mockRejectedValue(new Error('Geofence validation failed: Too far from site'));

            const req = new NextRequest('http://localhost:3000/api/time-records/clock', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'clock-in',
                    rotationId: ROTATION_ID,
                    latitude: 34.0000,
                    longitude: -118.0000,
                    accuracy: 10
                })
            });

            const res = await POST(req);
            const data = await res.json();

            if (res.status !== 400) {
                console.log('DEBUG: Test failed. Status:', res.status);
                console.log('DEBUG: Response body:', JSON.stringify(data, null, 2));
            }

            expect(res.status).toBe(400); // Validation error maps to 400
            expect(data.error).toContain('Geofence validation failed');
        });

        it('should return 429 if rate limit exceeded', async () => {
            // Mock rate limiter to fail
            vi.mocked(clockOperationLimiter.checkLimit).mockResolvedValue({ allowed: false } as any);

            const req = new NextRequest('http://localhost:3000/api/time-records/clock', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'clock-in',
                    rotationId: ROTATION_ID
                })
            });

            const res = await POST(req);
            expect(res.status).toBe(429);
        });
    });

    describe('Clock Out', () => {
        it('should successfully clock out', async () => {
            const mockRecord = {
                id: RECORD_ID,
                studentId: 'student-1',
                rotationId: ROTATION_ID
            };

            // Mock DB with sequential returns
            const limitMock = vi.fn()
                .mockResolvedValueOnce([mockRecord]) // First call: Get record
                .mockResolvedValueOnce([{            // Second call: Get updated record
                    ...mockRecord,
                    clockOut: new Date(),
                    status: 'completed'
                }]);

            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: limitMock
                    })
                })
            } as any);

            vi.mocked(ClockService.clockOut).mockResolvedValue({
                recordId: RECORD_ID,
                timeValidation: { warnings: [] }
            } as any);

            const req = new NextRequest('http://localhost:3000/api/time-records/clock', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'clock-out',
                    timeRecordId: RECORD_ID,
                    activities: ['Patient Care'],
                    latitude: 34.0522,
                    longitude: -118.2437
                })
            });

            const res = await POST(req);
            expect(res.status).toBe(200);
            expect(ClockService.clockOut).toHaveBeenCalled();
        });

        it('should fail if not clocked in', async () => {
            // Mock DB to return record
            vi.mocked(db.select).mockReturnValue({
                from: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockResolvedValue([{ id: RECORD_ID, studentId: 'student-1' }])
                    })
                })
            } as any);

            vi.mocked(ClockService.clockOut).mockRejectedValue(new Error('Student is not currently clocked in'));

            const req = new NextRequest('http://localhost:3000/api/time-records/clock', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'clock-out',
                    timeRecordId: RECORD_ID
                })
            });

            const res = await POST(req);
            const data = await res.json();

            expect(res.status).toBe(409);
            expect(data.error).toBe('Student is not clocked in');
        });
    });
});
