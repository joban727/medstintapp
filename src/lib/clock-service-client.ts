import { type ClockInRequest, type ClockOutRequest, type ClockStatus } from "./clock-service"
import { offlineQueue } from "./offline-queue"
import { getTimeSyncService } from "./time-sync-service"
import { logger } from "./client-logger"

/**
 * Client-Side Clock Service
 * Handles clock operations from the browser, including offline support and API communication.
 */
export interface ClientClockInRequest {
    studentId?: string
    rotationId?: string
    siteId?: string
    timestamp?: string
    clientTimestamp?: string
    location?: {
        latitude: number
        longitude: number
        accuracy: number
        ipAddress?: string
        userAgent?: string
    }
    notes?: string
}

export class ClockServiceClient {
    /**
     * Clock in a student
     */
    static async clockIn(request: ClientClockInRequest): Promise<ClockStatus> {
        try {
            // Check if online
            if (typeof navigator !== "undefined" && !navigator.onLine) {
                return this.handleOfflineClockIn(request)
            }

            // Add client timestamp if not present
            if (!request.clientTimestamp) {
                const timeSync = getTimeSyncService()
                request.clientTimestamp = timeSync.getCurrentTime().toISOString()
            }

            const response = await fetch("/api/student/clock-in", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(request),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.message || `Clock-in failed with status ${response.status}`)
            }

            const result = await response.json()
            return result.data
        } catch (error) {
            logger.error({
                studentId: request.studentId,
                error: error instanceof Error ? error.message : "Unknown error",
            }, "Clock in failed")

            // If network error, queue for offline processing
            if (this.isNetworkError(error)) {
                return this.handleOfflineClockIn(request)
            }

            throw error
        }
    }

    /**
     * Clock out a student
     */
    static async clockOut(request: ClockOutRequest): Promise<ClockStatus> {
        try {
            // Check if online
            if (typeof navigator !== "undefined" && !navigator.onLine) {
                return this.handleOfflineClockOut(request)
            }

            // Add client timestamp if not present
            if (!request.clientTimestamp) {
                const timeSync = getTimeSyncService()
                request.clientTimestamp = timeSync.getCurrentTime().toISOString()
            }

            const response = await fetch("/api/student/clock-out", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(request),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.message || `Clock-out failed with status ${response.status}`)
            }

            const result = await response.json()
            return result.data
        } catch (error) {
            logger.error({
                studentId: request.studentId,
                error: error instanceof Error ? error.message : "Unknown error",
            }, "Clock out failed")

            // If network error, queue for offline processing
            if (this.isNetworkError(error)) {
                return this.handleOfflineClockOut(request)
            }

            throw error
        }
    }

    /**
     * Get current clock status
     */
    static async getClockStatus(studentId: string): Promise<ClockStatus> {
        try {
            const response = await fetch(`/api/student/clock-status?studentId=${studentId}`)

            if (!response.ok) {
                throw new Error(`Failed to get status: ${response.status}`)
            }

            const result = await response.json()
            return result.data
        } catch (error) {
            logger.error({ error: String(error) }, "Failed to get clock status")
            // Return default offline/error status
            return {
                isClocked: false,
                clockedIn: false,
                currentDuration: 0
            }
        }
    }

    /**
     * Handle offline clock-in operation
     */
    private static async handleOfflineClockIn(request: ClientClockInRequest): Promise<ClockStatus> {
        const offlineTimestamp = new Date()

        // Queue the operation for when back online
        if (offlineQueue) {
            await offlineQueue.enqueue({
                type: "clock-in",
                data: {
                    ...request,
                    offlineTimestamp: offlineTimestamp.getTime(),
                },
                timestamp: Date.now(),
                maxRetries: 3,
                priority: "high",
            })
        }

        logger.info({
            studentId: request.studentId,
            offlineTimestamp: offlineTimestamp.toISOString(),
        }, "Clock-in queued for offline processing")

        // Return optimistic response
        return {
            isClocked: true,
            clockedIn: true,
            clockInTime: offlineTimestamp,
            currentDuration: 0,
            recordId: `offline-${Date.now()}`,
        }
    }

    /**
     * Handle offline clock-out operation
     */
    private static async handleOfflineClockOut(request: ClockOutRequest): Promise<ClockStatus> {
        const offlineTimestamp = new Date()

        // Queue the operation for when back online
        if (offlineQueue) {
            await offlineQueue.enqueue({
                type: "clock-out",
                data: {
                    ...request,
                    offlineTimestamp: offlineTimestamp.getTime(),
                },
                timestamp: Date.now(),
                maxRetries: 3,
                priority: "high",
            })
        }

        logger.info({
            studentId: request.studentId,
            offlineTimestamp: offlineTimestamp.toISOString(),
        }, "Clock-out queued for offline processing")

        // Return optimistic response
        return {
            isClocked: false,
            clockedIn: false,
            clockOutTime: offlineTimestamp,
            currentDuration: 0,
            recordId: `offline-${Date.now()}`,
        }
    }

    /**
     * Check if error is network-related
     */
    private static isNetworkError(error: unknown): boolean {
        if (error instanceof Error) {
            const message = error.message.toLowerCase()
            return (
                message.includes("network") ||
                message.includes("fetch") ||
                message.includes("connection") ||
                message.includes("timeout") ||
                message.includes("econnrefused") ||
                message.includes("enotfound")
            )
        }
        return false
    }
}
