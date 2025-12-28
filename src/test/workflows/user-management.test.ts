import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/user/update/route'
import { dbMock } from '@/test/mocks/stateful-db'
import { users } from '@/database/schema'
import { NextRequest } from 'next/server'

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
    auth: vi.fn(),
    currentUser: vi.fn()
}))

// Mock database
vi.mock('@/database/connection-pool', () => ({
    db: {
        select: (fields: any) => dbMock.select(fields),
        insert: (table: any) => dbMock.insert(table),
        update: (table: any) => dbMock.update(table),
        delete: (table: any) => dbMock.delete(table),
        execute: vi.fn().mockResolvedValue([{ test: 1 }]),
        transaction: (callback: any) => callback({
            select: (fields: any) => dbMock.select(fields),
            insert: (table: any) => dbMock.insert(table),
            update: (table: any) => dbMock.update(table),
            delete: (table: any) => dbMock.delete(table),
        })
    }
}))

import { auth } from '@clerk/nextjs/server'

describe('User Management Workflow', () => {
    beforeEach(() => {
        dbMock.reset()
        vi.clearAllMocks()

        // Register tables
        dbMock.registerTable(users, 'users')
    })

    it('should create a new user when they do not exist', async () => {
        const userId = 'user_123'
        const email = 'test@example.com'

        // Mock auth
        vi.mocked(auth).mockResolvedValue({
            userId,
            getToken: vi.fn(),
            sessionId: 'sess_123',
            actor: null,
            orgId: null,
            orgRole: null,
            orgSlug: null,
            orgPermissions: null,
            sessionClaims: null,
            has: () => true,
            debug: () => { },
        } as any)

        // Mock Clerk API fetch for new user
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                email_addresses: [{ email_address: email }],
                first_name: 'Test',
                last_name: 'User'
            })
        })

        const body = {
            role: 'STUDENT',
            name: 'Test User'
        }

        const req = new NextRequest('http://localhost:3000/api/user/update', {
            method: 'POST',
            body: JSON.stringify(body)
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.id).toBe(userId)
        expect(data.data.email).toBe(email)
        expect(data.data.role).toBe('STUDENT')

        // Verify DB state
        const storedUser = dbMock.getById('users', userId)
        expect(storedUser).toBeDefined()
        expect(storedUser.email).toBe(email)
    })

    it('should update an existing user', async () => {
        const userId = 'user_456'
        const initialUser = {
            id: userId,
            email: 'existing@example.com',
            name: 'Existing User',
            role: 'STUDENT',
            isActive: true
        }

        // Seed DB
        // Seed DB
        await dbMock.insert(users).values(initialUser)

        // Mock auth
        vi.mocked(auth).mockResolvedValue({
            userId,
            getToken: vi.fn(),
            sessionId: 'sess_456',
            actor: null,
            orgId: null,
            orgRole: null,
            orgSlug: null,
            orgPermissions: null,
            sessionClaims: null,
            has: () => true,
            debug: () => { },
        } as any)

        const updateData = {
            phone: '555-0123',
            address: '123 Test St'
        }

        const req = new NextRequest('http://localhost:3000/api/user/update', {
            method: 'POST',
            body: JSON.stringify(updateData)
        })

        const response = await POST(req)
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.data.phone).toBe(updateData.phone)
        expect(data.data.address).toBe(updateData.address)

        // Verify DB state
        const storedUser = dbMock.getById('users', userId)
        expect(storedUser.phone).toBe(updateData.phone)
        expect(storedUser.address).toBe(updateData.address)
    })

    it('should handle unauthorized access', async () => {
        // Mock no auth
        vi.mocked(auth).mockResolvedValue({ userId: null } as any)

        const req = new NextRequest('http://localhost:3000/api/user/update', {
            method: 'POST',
            body: JSON.stringify({})
        })

        const response = await POST(req)
        expect(response.status).toBe(401)
    })
})
