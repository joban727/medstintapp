import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { withCSRF } from '@/lib/csrf-middleware'

// Mock NextRequest and NextResponse
vi.mock('next/server', async () => {
    const actual = await vi.importActual('next/server')
    return {
        ...actual,
        NextResponse: {
            json: vi.fn((body, init) => ({
                body,
                status: init?.status || 200,
                headers: new Map(Object.entries(init?.headers || {})),
            })),
            next: vi.fn(),
        },
    }
})

describe('CSRF Protection Middleware', () => {
    let mockHandler: any

    beforeEach(() => {
        mockHandler = vi.fn().mockResolvedValue(new Response('Success', { status: 200 }))
        vi.clearAllMocks()
    })

    const createRequest = (method: string, url: string, headers: Record<string, string> = {}, cookies: Record<string, string> = {}) => {
        const req = new NextRequest(new URL(url, 'http://localhost'), {
            method,
            headers: new Headers(headers),
        })

        // Mock cookies
        Object.defineProperty(req, 'cookies', {
            value: {
                get: (name: string) => cookies[name] ? { value: cookies[name] } : undefined,
                getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value })),
            },
            writable: true,
        })

        return req
    }

    it('should allow GET requests without CSRF token', async () => {
        const protectedHandler = withCSRF(mockHandler)
        const req = createRequest('GET', '/api/data')

        await protectedHandler(req)

        expect(mockHandler).toHaveBeenCalled()
    })

    it('should block POST requests without CSRF token', async () => {
        const protectedHandler = withCSRF(mockHandler)
        const req = createRequest('POST', '/api/data')

        const response = await protectedHandler(req)

        expect(mockHandler).not.toHaveBeenCalled()
        expect(response.status).toBe(403)
        expect((response as any).body).toEqual({ error: 'Invalid or missing CSRF token' })
    })

    it('should block POST requests with missing header token', async () => {
        const protectedHandler = withCSRF(mockHandler)
        const req = createRequest('POST', '/api/data', {}, { '__csrf': 'valid-token' })

        const response = await protectedHandler(req)

        expect(mockHandler).not.toHaveBeenCalled()
        expect(response.status).toBe(403)
    })

    it('should block POST requests with missing cookie token', async () => {
        const protectedHandler = withCSRF(mockHandler)
        const req = createRequest('POST', '/api/data', { 'x-csrf-token': 'valid-token' }, {})

        const response = await protectedHandler(req)

        expect(mockHandler).not.toHaveBeenCalled()
        expect(response.status).toBe(403)
    })

    it('should block POST requests with mismatched tokens', async () => {
        const protectedHandler = withCSRF(mockHandler)
        const req = createRequest('POST', '/api/data',
            { 'x-csrf-token': 'token-a' },
            { '__csrf': 'token-b' }
        )

        const response = await protectedHandler(req)

        expect(mockHandler).not.toHaveBeenCalled()
        expect(response.status).toBe(403)
    })

    it('should allow POST requests with matching tokens', async () => {
        const protectedHandler = withCSRF(mockHandler)
        const token = 'valid-token-123'
        const req = createRequest('POST', '/api/data',
            { 'x-csrf-token': token },
            { '__csrf': token }
        )

        await protectedHandler(req)

        expect(mockHandler).toHaveBeenCalled()
    })

    it('should allow PUT requests with matching tokens', async () => {
        const protectedHandler = withCSRF(mockHandler)
        const token = 'valid-token-123'
        const req = createRequest('PUT', '/api/data',
            { 'x-csrf-token': token },
            { '__csrf': token }
        )

        await protectedHandler(req)

        expect(mockHandler).toHaveBeenCalled()
    })

    it('should allow DELETE requests with matching tokens', async () => {
        const protectedHandler = withCSRF(mockHandler)
        const token = 'valid-token-123'
        const req = createRequest('DELETE', '/api/data',
            { 'x-csrf-token': token },
            { '__csrf': token }
        )

        await protectedHandler(req)

        expect(mockHandler).toHaveBeenCalled()
    })

    it('should skip CSRF check for webhook routes', async () => {
        const protectedHandler = withCSRF(mockHandler)
        const req = createRequest('POST', '/api/webhooks/stripe')

        await protectedHandler(req)

        expect(mockHandler).toHaveBeenCalled()
    })
})
