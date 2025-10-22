/**
 * Location Integration Tests
 * Tests the enhanced location capture functionality in the clock system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import type { ClockInterface } from '@/components/student/clock-interface'

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }
}))

vi.mock('@/hooks/use-location', () => ({
  useLocation: () => ({
    locationState: {
      currentLocation: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        source: 'gps'
      }
    },
    locationSupported: true,
    locationPermission: true,
    captureLocation: vi.fn().mockResolvedValue({
      latitude: 40.7128,
      longitude: -74.0060,
      accuracy: 10,
      source: 'gps'
    })
  })
}))

// Mock fetch
global.fetch = vi.fn()

describe('Location Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock successful API responses
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { recordId: 'test-123' } })
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Clock-in with Location', () => {
    it('should successfully clock in with location data', async () => {
      const mockProps = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        sites: [{ id: 'site-1', name: 'Test Hospital', address: '123 Test St' }],
        clockStatus: null,
        locationRequired: true,
        onStatusChange: vi.fn()
      }

      render(<ClockInterface {...mockProps} />)

      // Select a site
      const siteSelect = screen.getByRole('combobox')
      fireEvent.click(siteSelect)
      fireEvent.click(screen.getByText('Test Hospital'))

      // Click clock in
      const clockInButton = screen.getByText('Clock In')
      fireEvent.click(clockInButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/time-records/clock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'clock-in',
            studentId: 'student-123',
            rotationId: 'rotation-456',
            siteId: 'site-1',
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 10,
            locationSource: 'gps'
          })
        })
      })

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Successfully clocked in!')
      )
    })

    it('should handle location permission denied', async () => {
      // Mock location permission denied
      vi.mocked(require('@/hooks/use-location').useLocation).mockReturnValue({
        locationState: { currentLocation: null },
        locationSupported: true,
        locationPermission: false,
        captureLocation: vi.fn().mockRejectedValue(new Error('Permission denied'))
      })

      const mockProps = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        sites: [{ id: 'site-1', name: 'Test Hospital', address: '123 Test St' }],
        clockStatus: null,
        locationRequired: true,
        onStatusChange: vi.fn()
      }

      render(<ClockInterface {...mockProps} />)

      // Select a site
      const siteSelect = screen.getByRole('combobox')
      fireEvent.click(siteSelect)
      fireEvent.click(screen.getByText('Test Hospital'))

      // Click clock in
      const clockInButton = screen.getByText('Clock In')
      fireEvent.click(clockInButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Location permission is required')
        )
      })
    })

    it('should handle unsupported location services', async () => {
      // Mock unsupported location
      vi.mocked(require('@/hooks/use-location').useLocation).mockReturnValue({
        locationState: { currentLocation: null },
        locationSupported: false,
        locationPermission: false,
        captureLocation: vi.fn()
      })

      const mockProps = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        sites: [{ id: 'site-1', name: 'Test Hospital', address: '123 Test St' }],
        clockStatus: null,
        locationRequired: true,
        onStatusChange: vi.fn()
      }

      render(<ClockInterface {...mockProps} />)

      // Select a site
      const siteSelect = screen.getByRole('combobox')
      fireEvent.click(siteSelect)
      fireEvent.click(screen.getByText('Test Hospital'))

      // Click clock in
      const clockInButton = screen.getByText('Clock In')
      fireEvent.click(clockInButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Location services are not supported')
        )
      })
    })
  })

  describe('Clock-out with Location', () => {
    it('should successfully clock out with location data', async () => {
      const mockProps = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        sites: [{ id: 'site-1', name: 'Test Hospital', address: '123 Test St' }],
        clockStatus: { 
          isActive: true, 
          recordId: 'record-123',
          clockInTime: new Date().toISOString(),
          site: { name: 'Test Hospital' }
        },
        locationRequired: true,
        onStatusChange: vi.fn()
      }

      render(<ClockInterface {...mockProps} />)

      // Click clock out
      const clockOutButton = screen.getByText('Clock Out')
      fireEvent.click(clockOutButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/time-records/clock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'clock-out',
            timeRecordId: 'record-123',
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 10,
            locationSource: 'gps'
          })
        })
      })

      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Successfully clocked out!')
      )
    })

    it('should allow manual clock-out when location fails', async () => {
      // Mock location capture failure
      vi.mocked(require('@/hooks/use-location').useLocation).mockReturnValue({
        locationState: { currentLocation: null },
        locationSupported: true,
        locationPermission: true,
        captureLocation: vi.fn().mockRejectedValue(new Error('Location timeout'))
      })

      // Mock confirm dialog
      global.confirm = vi.fn().mockReturnValue(true)

      const mockProps = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        sites: [{ id: 'site-1', name: 'Test Hospital', address: '123 Test St' }],
        clockStatus: { 
          isActive: true, 
          recordId: 'record-123',
          clockInTime: new Date().toISOString(),
          site: { name: 'Test Hospital' }
        },
        locationRequired: true,
        onStatusChange: vi.fn()
      }

      render(<ClockInterface {...mockProps} />)

      // Click clock out
      const clockOutButton = screen.getByText('Clock Out')
      fireEvent.click(clockOutButton)

      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith(
          expect.stringContaining('Location capture failed')
        )
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/time-records/clock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'clock-out',
            timeRecordId: 'record-123'
          })
        })
      })
    })
  })

  describe('API Integration', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      const mockProps = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        sites: [{ id: 'site-1', name: 'Test Hospital', address: '123 Test St' }],
        clockStatus: null,
        locationRequired: true,
        onStatusChange: vi.fn()
      }

      render(<ClockInterface {...mockProps} />)

      // Select a site
      const siteSelect = screen.getByRole('combobox')
      fireEvent.click(siteSelect)
      fireEvent.click(screen.getByText('Test Hospital'))

      // Click clock in
      const clockInButton = screen.getByText('Clock In')
      fireEvent.click(clockInButton)

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('Network error')
        )
      })
    })

    it('should send location data to backup API', async () => {
      const mockProps = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        sites: [{ id: 'site-1', name: 'Test Hospital', address: '123 Test St' }],
        clockStatus: null,
        locationRequired: true,
        onStatusChange: vi.fn()
      }

      render(<ClockInterface {...mockProps} />)

      // Select a site
      const siteSelect = screen.getByRole('combobox')
      fireEvent.click(siteSelect)
      fireEvent.click(screen.getByText('Test Hospital'))

      // Click clock in
      const clockInButton = screen.getByText('Clock In')
      fireEvent.click(clockInButton)

      await waitFor(() => {
        // Should call both the main clock API and the location backup API
        expect(global.fetch).toHaveBeenCalledTimes(2)
        expect(global.fetch).toHaveBeenCalledWith('/api/location/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timeRecordId: 'test-123',
            captureType: 'clock_in',
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 10,
            source: 'gps',
            timestamp: expect.any(String)
          })
        })
      })
    })
  })

  describe('Location Accuracy Handling', () => {
    it('should display accuracy information in success message', async () => {
      const mockProps = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        sites: [{ id: 'site-1', name: 'Test Hospital', address: '123 Test St' }],
        clockStatus: null,
        locationRequired: true,
        onStatusChange: vi.fn()
      }

      render(<ClockInterface {...mockProps} />)

      // Select a site
      const siteSelect = screen.getByRole('combobox')
      fireEvent.click(siteSelect)
      fireEvent.click(screen.getByText('Test Hospital'))

      // Click clock in
      const clockInButton = screen.getByText('Clock In')
      fireEvent.click(clockInButton)

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          expect.stringContaining('10m accuracy')
        )
      })
    })

    it('should handle low accuracy location data', async () => {
      // Mock low accuracy location
      vi.mocked(require('@/hooks/use-location').useLocation).mockReturnValue({
        locationState: {
          currentLocation: {
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 500, // Low accuracy
            source: 'network'
          }
        },
        locationSupported: true,
        locationPermission: true,
        captureLocation: vi.fn().mockResolvedValue({
          latitude: 40.7128,
          longitude: -74.0060,
          accuracy: 500,
          source: 'network'
        })
      })

      const mockProps = {
        studentId: 'student-123',
        rotationId: 'rotation-456',
        sites: [{ id: 'site-1', name: 'Test Hospital', address: '123 Test St' }],
        clockStatus: null,
        locationRequired: true,
        onStatusChange: vi.fn()
      }

      render(<ClockInterface {...mockProps} />)

      // Select a site
      const siteSelect = screen.getByRole('combobox')
      fireEvent.click(siteSelect)
      fireEvent.click(screen.getByText('Test Hospital'))

      // Click clock in
      const clockInButton = screen.getByText('Clock In')
      fireEvent.click(clockInButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/time-records/clock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'clock-in',
            studentId: 'student-123',
            rotationId: 'rotation-456',
            siteId: 'site-1',
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 500,
            locationSource: 'network'
          })
        })
      })
    })
  })
})