# Testing Implementation Plan - MedStint Clerk Application

## 1. Current Testing Status Assessment

### 1.1 Existing Test Infrastructure ✅
- **Testing Framework**: Vitest with jsdom environment
- **Coverage Tool**: Vitest Coverage (v8 provider)
- **Test Utilities**: @testing-library/jest-dom
- **Mock Setup**: Comprehensive mocks for WebSocket, fetch, localStorage, geolocation
- **CI/CD**: Basic GitHub Actions workflow configured

### 1.2 Current Test Coverage Analysis
```
Existing Test Files:
├── src/tests/
│   ├── setup.ts ✅ (Comprehensive mock setup)
│   ├── clock-service.test.ts ✅ (Partial - 200/478 lines)
│   ├── api-endpoints.test.ts ✅ (Basic API testing)
│   ├── admin-query-validation.test.ts ✅
│   ├── database-optimization.test.ts ✅
│   ├── location-integration.test.ts ✅
│   └── simple-integration.test.ts ✅
├── src/__tests__/
│   ├── dashboard-routing.test.ts ✅
│   └── middleware/ ✅
```

### 1.3 Coverage Gaps Identified 🔍
- **Student Dashboard Components**: Missing comprehensive tests
- **Clinical Site Management**: Limited test coverage
- **Authentication Flows**: Partial coverage
- **Performance Testing**: Not implemented
- **Security Testing**: Not implemented
- **E2E Testing**: Not implemented

## 2. Enhanced Testing Framework Setup

### 2.1 Additional Dependencies Required
```json
{
  "devDependencies": {
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.4.3",
    "playwright": "^1.40.0",
    "artillery": "^2.0.0",
    "owasp-zap": "^0.2.0",
    "msw": "^2.0.0",
    "nock": "^13.4.0"
  }
}
```

### 2.2 Enhanced Test Configuration
```typescript
// vitest.config.enhanced.ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [
      './src/tests/setup.ts',
      './src/tests/setup-enhanced.ts'
    ],
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.idea',
      '.git',
      '.cache',
      'e2e/**/*'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        'src/database/seed.ts',
        'src/lib/mock-clinical-data.ts'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 85,
          statements: 85
        },
        'src/lib/clock-service.ts': {
          branches: 95,
          functions: 95,
          lines: 95,
          statements: 95
        },
        'src/app/api/**/*.ts': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    testTimeout: 15000,
    hookTimeout: 15000,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

## 3. Unit Testing Implementation

### 3.1 Critical Component Tests

#### Student Dashboard Client Tests
```typescript
// src/tests/components/student-dashboard-client.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StudentDashboardClient } from '@/components/dashboard/student-dashboard-client'

describe('StudentDashboardClient', () => {
  const mockProps = {
    initialData: {
      currentRotation: null,
      assignedSites: [],
      clockStatus: null,
      recentTimeRecords: []
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Site Selection', () => {
    it('should enable site selection when not clocked in', async () => {
      render(<StudentDashboardClient {...mockProps} />)
      
      const siteSelect = screen.getByRole('combobox', { name: /select site/i })
      expect(siteSelect).not.toBeDisabled()
    })

    it('should disable site selection when clocked in', async () => {
      const clockedInProps = {
        ...mockProps,
        initialData: {
          ...mockProps.initialData,
          clockStatus: { status: 'in' as const, lastClockIn: new Date() }
        }
      }

      render(<StudentDashboardClient {...clockedInProps} />)
      
      const siteSelect = screen.getByRole('combobox', { name: /select site/i })
      expect(siteSelect).toBeDisabled()
    })

    it('should populate available sites when no assigned sites', async () => {
      // Mock API response for available sites
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { id: 'site-1', name: 'Hospital A' },
          { id: 'site-2', name: 'Clinic B' }
        ])
      })

      render(<StudentDashboardClient {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('Hospital A')).toBeInTheDocument()
        expect(screen.getByText('Clinic B')).toBeInTheDocument()
      })
    })
  })

  describe('Clock In/Out Functionality', () => {
    it('should enable clock-in button when site is selected', async () => {
      const user = userEvent.setup()
      
      render(<StudentDashboardClient {...mockProps} />)
      
      // Select a site first
      const siteSelect = screen.getByRole('combobox')
      await user.click(siteSelect)
      await user.click(screen.getByText('Hospital A'))
      
      const clockButton = screen.getByRole('button', { name: /clock in/i })
      expect(clockButton).not.toBeDisabled()
    })

    it('should show clock-out button when clocked in', () => {
      const clockedInProps = {
        ...mockProps,
        initialData: {
          ...mockProps.initialData,
          clockStatus: { status: 'in' as const, lastClockIn: new Date() }
        }
      }

      render(<StudentDashboardClient {...clockedInProps} />)
      
      expect(screen.getByRole('button', { name: /clock out/i })).toBeInTheDocument()
    })

    it('should handle clock-in API call', async () => {
      const user = userEvent.setup()
      
      // Mock successful clock-in response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, timeRecordId: 'record-123' })
      })

      render(<StudentDashboardClient {...mockProps} />)
      
      const clockButton = screen.getByRole('button', { name: /clock in/i })
      await user.click(clockButton)
      
      expect(global.fetch).toHaveBeenCalledWith('/api/clock/in', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }))
    })
  })

  describe('Error Handling', () => {
    it('should display error message on clock-in failure', async () => {
      const user = userEvent.setup()
      
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Location too far from site' })
      })

      render(<StudentDashboardClient {...mockProps} />)
      
      const clockButton = screen.getByRole('button', { name: /clock in/i })
      await user.click(clockButton)
      
      await waitFor(() => {
        expect(screen.getByText(/location too far/i)).toBeInTheDocument()
      })
    })
  })
})
```

#### Clock Service Tests Enhancement
```typescript
// src/tests/lib/clock-service.enhanced.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ClockService } from '@/lib/clock-service'

describe('ClockService - Enhanced Tests', () => {
  let clockService: ClockService

  beforeEach(() => {
    clockService = new ClockService()
    vi.clearAllMocks()
  })

  describe('Business Logic Validation', () => {
    it('should enforce maximum daily hours limit', async () => {
      // Test 12-hour daily limit enforcement
      const clockInRequest = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        location: { latitude: 40.7128, longitude: -74.0060, accuracy: 10 },
        timestamp: new Date().toISOString()
      }

      // Mock existing 11 hours for today
      vi.mocked(db.select).mockResolvedValueOnce([{
        totalHours: '11.0'
      }])

      await expect(clockService.clockIn(clockInRequest))
        .rejects.toThrow('Daily hour limit exceeded')
    })

    it('should validate rotation schedule compliance', async () => {
      // Test rotation schedule validation
      const weekendClockIn = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        location: { latitude: 40.7128, longitude: -74.0060, accuracy: 10 },
        timestamp: new Date('2024-01-06T08:00:00Z').toISOString() // Saturday
      }

      // Mock rotation that doesn't allow weekends
      vi.mocked(getCachedSiteData).mockResolvedValueOnce({
        id: 'rotation-456',
        allowWeekends: false,
        operatingHours: { monday: '08:00-17:00' }
      })

      await expect(clockService.clockIn(weekendClockIn))
        .rejects.toThrow('Rotation not scheduled for weekends')
    })
  })

  describe('Concurrent Access Handling', () => {
    it('should handle concurrent clock-in attempts', async () => {
      const request1 = clockService.clockIn(validClockInRequest)
      const request2 = clockService.clockIn(validClockInRequest)

      const results = await Promise.allSettled([request1, request2])
      
      // One should succeed, one should fail
      const successes = results.filter(r => r.status === 'fulfilled')
      const failures = results.filter(r => r.status === 'rejected')
      
      expect(successes).toHaveLength(1)
      expect(failures).toHaveLength(1)
    })
  })

  describe('Data Integrity', () => {
    it('should maintain accurate hour calculations', async () => {
      const clockOutRequest = {
        studentId: 'student-123',
        timeRecordId: 'record-123',
        location: { latitude: 40.7128, longitude: -74.0060, accuracy: 10 },
        timestamp: new Date('2024-01-01T17:00:00Z').toISOString()
      }

      // Mock clock-in at 08:00
      vi.mocked(getActiveTimeRecord).mockResolvedValueOnce({
        id: 'record-123',
        clockInTime: new Date('2024-01-01T08:00:00Z'),
        studentId: 'student-123'
      })

      const result = await clockService.clockOut(clockOutRequest)
      
      expect(result.data?.totalHours).toBe(9.0) // 9 hours exactly
    })
  })
})
```

### 3.2 API Endpoint Tests

#### Clinical Sites API Tests
```typescript
// src/tests/api/competencies.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { POST } from '@/app/api/competencies/route'
import { NextRequest } from 'next/server'

describe('/api/competencies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST - Create Clinical Site', () => {
    it('should create clinical site and assign to students', async () => {
      const requestBody = {
        name: 'New Hospital',
        address: '123 Medical St',
        city: 'Healthcare City',
        state: 'HC',
        zipCode: '12345'
      }

      const request = new NextRequest('http://localhost:3000/api/competencies', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' }
      })

      // Mock authentication
      vi.mocked(auth).mockResolvedValueOnce({
        userId: 'admin-123',
        sessionClaims: { metadata: { role: 'SCHOOL_ADMIN' } }
      })

      // Mock database operations
      vi.mocked(db.insert).mockResolvedValueOnce([{ id: 'site-123' }])
      vi.mocked(db.select).mockResolvedValueOnce([
        { id: 'student-1' },
        { id: 'student-2' }
      ])

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.siteId).toBe('site-123')
      expect(data.assignmentsCreated).toBe(2)
    })

    it('should reject unauthorized users', async () => {
      const request = new NextRequest('http://localhost:3000/api/competencies', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Site' })
      })

      vi.mocked(auth).mockResolvedValueOnce(null)

      const response = await POST(request)
      
      expect(response.status).toBe(401)
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/competencies', {
        method: 'POST',
        body: JSON.stringify({ name: '' }) // Missing required fields
      })

      vi.mocked(auth).mockResolvedValueOnce({
        userId: 'admin-123',
        sessionClaims: { metadata: { role: 'SCHOOL_ADMIN' } }
      })

      const response = await POST(request)
      
      expect(response.status).toBe(400)
    })
  })
})
```

## 4. Integration Testing Implementation

### 4.1 Database Integration Tests
```typescript
// src/tests/integration/site-assignment-flow.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { db } from '@/database/db'
import { clinicalSites, siteAssignments, users } from '@/database/schema'

describe('Site Assignment Integration Flow', () => {
  let testSchoolId: string
  let testAdminId: string
  let testStudentIds: string[]

  beforeEach(async () => {
    // Setup test data
    testSchoolId = 'test-school-123'
    testAdminId = 'test-admin-123'
    testStudentIds = ['student-1', 'student-2', 'student-3']

    // Create test users
    await db.insert(users).values([
      {
        id: testAdminId,
        email: 'admin@test.com',
        role: 'SCHOOL_ADMIN',
        schoolId: testSchoolId
      },
      ...testStudentIds.map(id => ({
        id,
        email: `${id}@test.com`,
        role: 'STUDENT',
        schoolId: testSchoolId
      }))
    ])
  })

  afterEach(async () => {
    // Cleanup test data
    await db.delete(siteAssignments).where(eq(siteAssignments.schoolId, testSchoolId))
    await db.delete(clinicalSites).where(eq(clinicalSites.schoolId, testSchoolId))
    await db.delete(users).where(eq(users.schoolId, testSchoolId))
  })

  it('should complete full site assignment workflow', async () => {
    // 1. School admin creates clinical site
    const [newSite] = await db.insert(clinicalSites).values({
      name: 'Integration Test Hospital',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      schoolId: testSchoolId,
      createdBy: testAdminId
    }).returning()

    expect(newSite.id).toBeDefined()

    // 2. Verify automatic student assignments were created
    const assignments = await db.select()
      .from(siteAssignments)
      .where(eq(siteAssignments.clinicalSiteId, newSite.id))

    expect(assignments).toHaveLength(testStudentIds.length)
    
    // 3. Verify each student can see the site
    for (const studentId of testStudentIds) {
      const studentSites = await db.select({
        siteId: clinicalSites.id,
        siteName: clinicalSites.name
      })
      .from(siteAssignments)
      .innerJoin(clinicalSites, eq(siteAssignments.clinicalSiteId, clinicalSites.id))
      .where(eq(siteAssignments.studentId, studentId))

      expect(studentSites).toContainEqual({
        siteId: newSite.id,
        siteName: 'Integration Test Hospital'
      })
    }

    // 4. Test site availability API
    const availableSites = await fetch(`/api/sites/available?studentId=${testStudentIds[0]}`)
    const sitesData = await availableSites.json()
    
    expect(sitesData).toContainEqual(
      expect.objectContaining({
        id: newSite.id,
        name: 'Integration Test Hospital'
      })
    )
  })

  it('should handle concurrent site creation', async () => {
    const siteCreationPromises = Array.from({ length: 5 }, (_, i) =>
      db.insert(clinicalSites).values({
        name: `Concurrent Site ${i + 1}`,
        address: `${i + 1} Concurrent St`,
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        schoolId: testSchoolId,
        createdBy: testAdminId
      }).returning()
    )

    const results = await Promise.all(siteCreationPromises)
    
    // Verify all sites were created
    expect(results).toHaveLength(5)
    results.forEach(([site]) => {
      expect(site.id).toBeDefined()
    })

    // Verify all students got assignments for all sites
    const totalAssignments = await db.select()
      .from(siteAssignments)
      .where(eq(siteAssignments.schoolId, testSchoolId))

    expect(totalAssignments).toHaveLength(5 * testStudentIds.length) // 5 sites × 3 students
  })
})
```

### 4.2 Authentication Flow Tests
```typescript
// src/tests/integration/auth-flow.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { auth } from '@clerk/nextjs/server'
import { requireRole } from '@/lib/auth'

describe('Authentication Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Role-Based Access Control', () => {
    it('should allow school admin to access site management', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: 'admin-123',
        sessionClaims: {
          metadata: { role: 'SCHOOL_ADMIN', schoolId: 'school-123' }
        }
      })

      const user = await requireRole(['SCHOOL_ADMIN'], '/dashboard')
      
      expect(user.role).toBe('SCHOOL_ADMIN')
      expect(user.schoolId).toBe('school-123')
    })

    it('should redirect unauthorized users', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: 'student-123',
        sessionClaims: {
          metadata: { role: 'STUDENT', schoolId: 'school-123' }
        }
      })

      await expect(requireRole(['SCHOOL_ADMIN'], '/dashboard'))
        .rejects.toThrow('Insufficient permissions')
    })

    it('should handle missing authentication', async () => {
      vi.mocked(auth).mockResolvedValueOnce(null)

      await expect(requireRole(['STUDENT'], '/dashboard'))
        .rejects.toThrow('Authentication required')
    })
  })

  describe('Cross-School Data Isolation', () => {
    it('should prevent cross-school data access', async () => {
      // Test that school A admin cannot access school B data
      vi.mocked(auth).mockResolvedValueOnce({
        userId: 'admin-a',
        sessionClaims: {
          metadata: { role: 'SCHOOL_ADMIN', schoolId: 'school-a' }
        }
      })

      const schoolBSites = await db.select()
        .from(clinicalSites)
        .where(eq(clinicalSites.schoolId, 'school-b'))

      // Should return empty array due to school isolation
      expect(schoolBSites).toHaveLength(0)
    })
  })
})
```

## 5. Performance Testing Implementation

### 5.1 Load Testing Configuration
```javascript
// tests/performance/load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 120
      arrivalRate: 20
      name: "Normal load"
    - duration: 60
      arrivalRate: 50
      name: "Peak load"
    - duration: 30
      arrivalRate: 100
      name: "Stress test"
  processor: "./load-test-processor.js"

scenarios:
  - name: "Student Dashboard Flow"
    weight: 40
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "student{{ $randomInt(1, 1000) }}@test.com"
            password: "testpass123"
          capture:
            - json: "$.token"
              as: "authToken"
      - get:
          url: "/api/student/dashboard"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
            - contentType: json
      - post:
          url: "/api/clock/in"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            rotationId: "rotation-{{ $randomInt(1, 10) }}"
            location:
              latitude: 40.7128
              longitude: -74.0060
          expect:
            - statusCode: 200

  - name: "Site Management Flow"
    weight: 20
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "admin{{ $randomInt(1, 50) }}@test.com"
            password: "adminpass123"
          capture:
            - json: "$.token"
              as: "authToken"
      - get:
          url: "/api/competencies"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
      - post:
          url: "/api/competencies"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            name: "Load Test Site {{ $randomString() }}"
            address: "123 Test St"
            city: "Test City"
            state: "TS"
            zipCode: "12345"
          expect:
            - statusCode: 201

  - name: "API Health Check"
    weight: 40
    flow:
      - get:
          url: "/api/health"
          expect:
            - statusCode: 200
            - hasProperty: "status"
```

### 5.2 Performance Benchmarking
```typescript
// src/tests/performance/benchmark.test.ts
import { describe, it, expect } from 'vitest'
import { performance } from 'perf_hooks'

describe('Performance Benchmarks', () => {
  describe('API Response Times', () => {
    it('should respond to dashboard API within 200ms', async () => {
      const start = performance.now()
      
      const response = await fetch('/api/student/dashboard', {
        headers: { Authorization: 'Bearer test-token' }
      })
      
      const end = performance.now()
      const responseTime = end - start

      expect(response.ok).toBe(true)
      expect(responseTime).toBeLessThan(200)
    })

    it('should handle clock-in within 100ms', async () => {
      const start = performance.now()
      
      const response = await fetch('/api/clock/in', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token'
        },
        body: JSON.stringify({
          rotationId: 'test-rotation',
          location: { latitude: 40.7128, longitude: -74.0060 }
        })
      })
      
      const end = performance.now()
      const responseTime = end - start

      expect(response.ok).toBe(true)
      expect(responseTime).toBeLessThan(100)
    })
  })

  describe('Database Query Performance', () => {
    it('should fetch available sites within 150ms', async () => {
      const start = performance.now()
      
      const sites = await db.select()
        .from(clinicalSites)
        .innerJoin(siteAssignments, eq(clinicalSites.id, siteAssignments.clinicalSiteId))
        .where(eq(siteAssignments.studentId, 'test-student'))
        .limit(50)
      
      const end = performance.now()
      const queryTime = end - start

      expect(sites).toBeDefined()
      expect(queryTime).toBeLessThan(150)
    })
  })

  describe('Memory Usage', () => {
    it('should not exceed memory limits during bulk operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed
      
      // Simulate bulk site creation
      const bulkSites = Array.from({ length: 1000 }, (_, i) => ({
        name: `Bulk Site ${i}`,
        address: `${i} Bulk St`,
        city: 'Bulk City',
        state: 'BC',
        zipCode: '12345',
        schoolId: 'test-school'
      }))

      await db.insert(clinicalSites).values(bulkSites)
      
      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = finalMemory - initialMemory
      
      // Should not increase by more than 50MB
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })
})
```

## 6. Security Testing Implementation

### 6.1 Authentication Security Tests
```typescript
// src/tests/security/auth-security.test.ts
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'

describe('Authentication Security', () => {
  describe('JWT Token Validation', () => {
    it('should reject expired tokens', async () => {
      const expiredToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDk0NTkxOTl9.invalid'
      
      const request = new NextRequest('http://localhost:3000/api/student/dashboard', {
        headers: { Authorization: `Bearer ${expiredToken}` }
      })

      const response = await GET(request)
      
      expect(response.status).toBe(401)
    })

    it('should reject malformed tokens', async () => {
      const malformedToken = 'invalid.token.format'
      
      const request = new NextRequest('http://localhost:3000/api/student/dashboard', {
        headers: { Authorization: `Bearer ${malformedToken}` }
      })

      const response = await GET(request)
      
      expect(response.status).toBe(401)
    })

    it('should validate token signature', async () => {
      const tamperedToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJhZG1pbiJ9.tampered_signature'
      
      const request = new NextRequest('http://localhost:3000/api/competencies', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tamperedToken}` },
        body: JSON.stringify({ name: 'Test Site' })
      })

      const response = await POST(request)
      
      expect(response.status).toBe(401)
    })
  })

  describe('Input Validation Security', () => {
    it('should prevent SQL injection in site creation', async () => {
      const maliciousInput = {
        name: "'; DROP TABLE clinicalSites; --",
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      }

      const request = new NextRequest('http://localhost:3000/api/competencies', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-admin-token'
        },
        body: JSON.stringify(maliciousInput)
      })

      const response = await POST(request)
      
      // Should either sanitize input or reject it
      expect(response.status).toBeOneOf([400, 201])
      
      // Verify table still exists
      const sites = await db.select().from(clinicalSites).limit(1)
      expect(sites).toBeDefined()
    })

    it('should prevent XSS in user inputs', async () => {
      const xssPayload = {
        name: '<script>alert("XSS")</script>',
        address: '123 Test St',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345'
      }

      const request = new NextRequest('http://localhost:3000/api/competencies', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-admin-token'
        },
        body: JSON.stringify(xssPayload)
      })

      const response = await POST(request)
      
      if (response.ok) {
        const data = await response.json()
        // Should be sanitized
        expect(data.name).not.toContain('<script>')
      }
    })
  })

  describe('Authorization Security', () => {
    it('should prevent privilege escalation', async () => {
      // Student trying to access admin endpoint
      const request = new NextRequest('http://localhost:3000/api/competencies', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-student-token'
        },
        body: JSON.stringify({ name: 'Unauthorized Site' })
      })

      const response = await POST(request)
      
      expect(response.status).toBe(403)
    })

    it('should prevent cross-school data access', async () => {
      // School A admin trying to access School B data
      const request = new NextRequest('http://localhost:3000/api/sites/available?schoolId=school-b', {
        headers: { Authorization: 'Bearer school-a-admin-token' }
      })

      const response = await GET(request)
      
      expect(response.status).toBeOneOf([403, 404])
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limits on API endpoints', async () => {
      const requests = Array.from({ length: 100 }, () =>
        fetch('/api/clock/in', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token'
          },
          body: JSON.stringify({
            rotationId: 'test-rotation',
            location: { latitude: 40.7128, longitude: -74.0060 }
          })
        })
      )

      const responses = await Promise.all(requests)
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })
})
```

## 7. End-to-End Testing Implementation

### 7.1 Playwright E2E Tests
```typescript
// tests/e2e/student-workflow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Student Complete Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test user and navigate to login
    await page.goto('/auth/sign-in')
  })

  test('complete student clock-in workflow', async ({ page }) => {
    // Login as student
    await page.fill('[data-testid="email-input"]', 'student@test.com')
    await page.fill('[data-testid="password-input"]', 'testpass123')
    await page.click('[data-testid="login-button"]')

    // Verify dashboard loads
    await expect(page).toHaveURL('/dashboard/student')
    await expect(page.locator('[data-testid="dashboard-title"]')).toContainText('Student Dashboard')

    // Select a clinical site
    await page.click('[data-testid="site-selector"]')
    await page.click('[data-testid="site-option-1"]')

    // Verify clock-in button is enabled
    const clockButton = page.locator('[data-testid="clock-in-button"]')
    await expect(clockButton).toBeEnabled()

    // Mock geolocation
    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation({ latitude: 40.7128, longitude: -74.0060 })

    // Click clock-in
    await clockButton.click()

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Successfully clocked in')

    // Verify UI updates
    await expect(page.locator('[data-testid="clock-status"]')).toContainText('Clocked In')
    await expect(page.locator('[data-testid="clock-out-button"]')).toBeVisible()

    // Clock out
    await page.click('[data-testid="clock-out-button"]')
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Successfully clocked out')
  })

  test('should handle location permission denial', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'student@test.com')
    await page.fill('[data-testid="password-input"]', 'testpass123')
    await page.click('[data-testid="login-button"]')

    await page.click('[data-testid="site-selector"]')
    await page.click('[data-testid="site-option-1"]')

    // Deny geolocation permission
    await page.context().grantPermissions([])

    await page.click('[data-testid="clock-in-button"]')

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Location access required')
  })

  test('should prevent clock-in when too far from site', async ({ page }) => {
    await page.fill('[data-testid="email-input"]', 'student@test.com')
    await page.fill('[data-testid="password-input"]', 'testpass123')
    await page.click('[data-testid="login-button"]')

    await page.click('[data-testid="site-selector"]')
    await page.click('[data-testid="site-option-1"]')

    // Set location far from site
    await page.context().setGeolocation({ latitude: 41.0000, longitude: -75.0000 })

    await page.click('[data-testid="clock-in-button"]')

    // Should show distance error
    await expect(page.locator('[data-testid="error-message"]')).toContainText('too far from site')
  })
})

test.describe('School Admin Workflow', () => {
  test('complete site creation and student assignment', async ({ page }) => {
    // Login as school admin
    await page.goto('/auth/sign-in')
    await page.fill('[data-testid="email-input"]', 'admin@test.com')
    await page.fill('[data-testid="password-input"]', 'adminpass123')
    await page.click('[data-testid="login-button"]')

    // Navigate to site management
    await page.goto('/dashboard/school-admin/sites')
    await expect(page.locator('[data-testid="sites-title"]')).toContainText('Clinical Sites')

    // Create new site
    await page.click('[data-testid="create-site-button"]')
    await page.fill('[data-testid="site-name-input"]', 'E2E Test Hospital')
    await page.fill('[data-testid="site-address-input"]', '123 E2E Test St')
    await page.fill('[data-testid="site-city-input"]', 'Test City')
    await page.selectOption('[data-testid="site-state-select"]', 'CA')
    await page.fill('[data-testid="site-zip-input"]', '90210')

    await page.click('[data-testid="save-site-button"]')

    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toContainText('Site created successfully')

    // Verify site appears in list
    await expect(page.locator('[data-testid="site-list"]')).toContainText('E2E Test Hospital')

    // Verify student assignments were created
    await page.goto('/dashboard/school-admin/students')
    await page.click('[data-testid="student-1"]')
    await expect(page.locator('[data-testid="assigned-sites"]')).toContainText('E2E Test Hospital')
  })
})
```

## 8. Test Execution and Reporting

### 8.1 Test Execution Scripts
```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run src/tests/unit",
    "test:integration": "vitest run src/tests/integration",
    "test:api": "vitest run src/tests/api",
    "test:security": "vitest run src/tests/security",
    "test:performance": "artillery run tests/performance/load-test.yml",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "test:coverage": "vitest run --coverage",
    "test:coverage:critical": "vitest run --coverage --reporter=json --outputFile=coverage-critical.json src/tests/critical",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:api && npm run test:security && npm run test:e2e",
    "test:ci": "npm run test:coverage && npm run test:performance && npm run test:e2e"
  }
}
```

### 8.2 Test Reporting Configuration
```typescript
// tests/reporters/custom-reporter.ts
import { Reporter } from 'vitest/reporters'

export class CustomTestReporter implements Reporter {
  onInit() {
    console.log('🧪 Starting MedStint Test Suite')
  }

  onFinished(files, errors) {
    const summary = {
      totalFiles: files.length,
      totalTests: files.reduce((acc, file) => acc + file.tasks.length, 0),
      passed: files.reduce((acc, file) => 
        acc + file.tasks.filter(task => task.result?.state === 'pass').length, 0),
      failed: files.reduce((acc, file) => 
        acc + file.tasks.filter(task => task.result?.state === 'fail').length, 0),
      duration: files.reduce((acc, file) => acc + (file.result?.duration || 0), 0)
    }

    console.log('\n📊 Test Summary:')
    console.log(`   Files: ${summary.totalFiles}`)
    console.log(`   Tests: ${summary.totalTests}`)
    console.log(`   Passed: ${summary.passed} ✅`)
    console.log(`   Failed: ${summary.failed} ${summary.failed > 0 ? '❌' : ''}`)
    console.log(`   Duration: ${summary.duration}ms`)

    if (summary.failed === 0) {
      console.log('\n🎉 All tests passed!')
    } else {
      console.log('\n⚠️  Some tests failed. Please review the results.')
    }
  }
}
```

## 9. Continuous Integration Setup

### 9.1 Enhanced GitHub Actions Workflow
```yaml
# .github/workflows/comprehensive-testing.yml
name: Comprehensive Testing Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run unit tests
        run: npm run test:unit
      
      - name: Upload unit test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: unit-test-results
          path: test-results/

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: medstint_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup test database
        run: |
          npm run db:migrate
          npm run db:seed:test
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/medstint_test
      
      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:testpass@localhost:5432/medstint_test

  security-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run security tests
        run: npm run test:security
      
      - name: Run OWASP ZAP scan
        uses: zaproxy/action-full-scan@v0.4.0
        with:
          target: 'http://localhost:3000'

  performance-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Start application
        run: |
          npm run build
          npm start &
          sleep 30
      
      - name: Run performance tests
        run: npm run test:performance
      
      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results/

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Start application
        run: |
          npm run build
          npm start &
          sleep 30
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload E2E results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: e2e-results
          path: test-results/

  coverage-report:
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests]
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate coverage report
        run: npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
          flags: unittests
          name: codecov-umbrella
      
      - name: Coverage threshold check
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 85" | bc -l) )); then
            echo "Coverage $COVERAGE% is below threshold of 85%"
            exit 1
          fi
```

## 10. Success Metrics and Monitoring

### 10.1 Quality Gates Dashboard
```typescript
// src/tests/quality-gates.ts
export interface QualityGates {
  coverage: {
    overall: number
    critical: number
    api: number
    components: number
  }
  performance: {
    apiResponseTime: number
    pageLoadTime: number
    databaseQueryTime: number
  }
  security: {
    vulnerabilities: {
      critical: number
      high: number
      medium: number
      low: number
    }
    authTests: number
    inputValidation: number
  }
  defects: {
    critical: number
    high: number
    medium: number
    low: number
  }
}

export const QUALITY_THRESHOLDS: QualityGates = {
  coverage: {
    overall: 85,
    critical: 100,
    api: 90,
    components: 80
  },
  performance: {
    apiResponseTime: 200,
    pageLoadTime: 2000,
    databaseQueryTime: 150
  },
  security: {
    vulnerabilities: {
      critical: 0,
      high: 0,
      medium: 5,
      low: 10
    },
    authTests: 100,
    inputValidation: 100
  },
  defects: {
    critical: 0,
    high: 0,
    medium: 5,
    low: 20
  }
}

export function validateQualityGates(metrics: QualityGates): boolean {
  const failures: string[] = []

  // Coverage checks
  if (metrics.coverage.overall < QUALITY_THRESHOLDS.coverage.overall) {
    failures.push(`Overall coverage ${metrics.coverage.overall}% below threshold ${QUALITY_THRESHOLDS.coverage.overall}%`)
  }

  if (metrics.coverage.critical < QUALITY_THRESHOLDS.coverage.critical) {
    failures.push(`Critical path coverage ${metrics.coverage.critical}% below threshold ${QUALITY_THRESHOLDS.coverage.critical}%`)
  }

  // Performance checks
  if (metrics.performance.apiResponseTime > QUALITY_THRESHOLDS.performance.apiResponseTime) {
    failures.push(`API response time ${metrics.performance.apiResponseTime}ms exceeds threshold ${QUALITY_THRESHOLDS.performance.apiResponseTime}ms`)
  }

  // Security checks
  if (metrics.security.vulnerabilities.critical > QUALITY_THRESHOLDS.security.vulnerabilities.critical) {
    failures.push(`Critical vulnerabilities found: ${metrics.security.vulnerabilities.critical}`)
  }

  if (metrics.security.vulnerabilities.high > QUALITY_THRESHOLDS.security.vulnerabilities.high) {
    failures.push(`High severity vulnerabilities found: ${metrics.security.vulnerabilities.high}`)
  }

  // Defect checks
  if (metrics.defects.critical > QUALITY_THRESHOLDS.defects.critical) {
    failures.push(`Critical defects found: ${metrics.defects.critical}`)
  }

  if (metrics.defects.high > QUALITY_THRESHOLDS.defects.high) {
    failures.push(`High severity defects found: ${metrics.defects.high}`)
  }

  if (failures.length > 0) {
    console.error('Quality Gates Failed:')
    failures.forEach(failure => console.error(`  ❌ ${failure}`))
    return false
  }

  console.log('✅ All Quality Gates Passed!')
  return true
}
```

This comprehensive testing implementation plan provides:

1. **Complete Test Coverage**: Unit, integration, system, performance, and security testing
2. **Automated Quality Gates**: Enforced coverage thresholds and performance benchmarks
3. **CI/CD Integration**: Automated testing pipeline with GitHub Actions
4. **Security Focus**: Comprehensive security testing including auth, input validation, and vulnerability scanning
5. **Performance Monitoring**: Load testing and performance benchmarking
6. **Defect Tracking**: Structured approach to issue classification and resolution
7. **Reporting**: Detailed test reporting and metrics collection

The implementation follows industry best practices and ensures robust, secure, and performant application delivery.