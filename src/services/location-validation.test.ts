import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateLocationWithGeofence } from './location-validation';
import { db } from '@/database/connection-pool';

// Mock DB
vi.mock('@/database/connection-pool', () => ({
    db: {
        select: vi.fn(),
    },
}));

describe('validateLocationWithGeofence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const setupDbMock = (siteData: any) => {
        const limitMock = vi.fn().mockResolvedValue(siteData ? [siteData] : []);
        const orderByMock = vi.fn().mockReturnValue({ limit: limitMock });
        const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
        const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
        const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
        vi.mocked(db.select).mockReturnValue({ from: fromMock } as any);
    };

    it('should allow location within radius', async () => {
        setupDbMock({
            site: { id: 'site-1', name: 'Test Site', address: '123 Test St' },
            location: { id: 'loc-1', radius: 100, strictGeofence: false },
            distance: 50,
        });

        const result = await validateLocationWithGeofence({
            userId: 'user-1',
            latitude: 40.0,
            longitude: -74.0,
            accuracy: 10,
        });

        expect(result.isValid).toBe(true);
        expect(result.isWithinGeofence).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should warn but allow location outside radius when NOT strict', async () => {
        setupDbMock({
            site: { id: 'site-1', name: 'Test Site', address: '123 Test St' },
            location: { id: 'loc-1', radius: 100, strictGeofence: false },
            distance: 150,
        });

        const result = await validateLocationWithGeofence({
            userId: 'user-1',
            latitude: 40.0,
            longitude: -74.0,
            accuracy: 10,
            strictMode: false,
        });

        expect(result.isValid).toBe(true); // Valid because not strict
        expect(result.isWithinGeofence).toBe(false);
        expect(result.warnings).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
    });

    it('should reject location outside radius when global strictMode is true', async () => {
        setupDbMock({
            site: { id: 'site-1', name: 'Test Site', address: '123 Test St' },
            location: { id: 'loc-1', radius: 100, strictGeofence: false },
            distance: 150,
        });

        const result = await validateLocationWithGeofence({
            userId: 'user-1',
            latitude: 40.0,
            longitude: -74.0,
            accuracy: 10,
            strictMode: true,
        });

        expect(result.isValid).toBe(false);
        expect(result.isWithinGeofence).toBe(false);
        expect(result.errors).toHaveLength(1);
    });

    it('should reject location outside radius when site strictGeofence is true (even if global strictMode is false)', async () => {
        setupDbMock({
            site: { id: 'site-1', name: 'Test Site', address: '123 Test St' },
            location: { id: 'loc-1', radius: 100, strictGeofence: true }, // Site enforces strictness
            distance: 150,
        });

        const result = await validateLocationWithGeofence({
            userId: 'user-1',
            latitude: 40.0,
            longitude: -74.0,
            accuracy: 10,
            strictMode: false,
        });

        expect(result.isValid).toBe(false);
        expect(result.isWithinGeofence).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors).toContain('This clinical site enforces strict geofencing.');
    });
});
