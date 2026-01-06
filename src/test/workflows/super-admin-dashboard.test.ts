import { describe, it, expect, vi, beforeEach } from "vitest"
import { getSystemStats } from "@/lib/admin/stats-service"
import { db } from "@/database/connection-pool"

// Mock database
vi.mock("@/database/connection-pool", () => ({
    db: {
        select: vi.fn()
    }
}))

describe("Super Admin Dashboard Stats", () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it("should calculate system stats correctly", async () => {
        // Mock data for counts
        const mockSchoolCount = [{ count: 10 }]
        const mockUserCount = [{ count: 100 }]
        const mockStudentCount = [{ count: 80 }]
        const mockAdminCount = [{ count: 10 }]
        const mockPreceptorCount = [{ count: 10 }]
        const mockActiveSubCount = [{ count: 50 }]

        // Mock data for revenue
        const mockActiveSubs = [
            { planId: "price_1", interval: "month", price: 2000 }, // $20
            { planId: "price_2", interval: "year", price: 24000 }  // $240/year = $20/month
        ]

        const mockSchoolsWithSeats = [
            { seatsUsed: 5 }, // 5 * $10 = $50
            { seatsUsed: 10 } // 10 * $10 = $100
        ]

        const mockSeatPlans = [
            { interval: "month", price: 1000, isActive: true, type: "SCHOOL_SEAT" },
            { interval: "year", price: 12000, isActive: true, type: "SCHOOL_SEAT" }
        ]

        const selectMock = vi.mocked(db.select)

        // Sequential mock strategy
        // The service makes 9 queries in a specific order:
        // 1. activeSubs (subscriptions)
        // 2. seatPlans (plans)
        // 3. schoolsWithSeats (schools)
        // 4. schoolCount (schools)
        // 5. userCount (users)
        // 6. studentCount (users)
        // 7. adminCount (users)
        // 8. preceptorCount (users)
        // 9. activeSubCount (subscriptions)

        let callCount = 0

        selectMock.mockImplementation(() => {
            callCount++

            // Helper to return chainable object
            const chain = {
                from: () => chain,
                leftJoin: () => chain,
                where: () => chain,
                orderBy: () => chain,
                limit: () => chain,
                then: (cb: any) => {
                    // This handles queries that are awaited directly without .where()
                    // Only userCount (call 5) fits this pattern in the service
                    if (callCount === 5) return cb(mockUserCount)
                    return cb([])
                }
            } as any

            // Override specific methods for queries that use them
            chain.from = () => {
                return {
                    ...chain,
                    leftJoin: () => ({
                        where: () => {
                            // 1. activeSubs
                            if (callCount === 1) return Promise.resolve(mockActiveSubs)
                            return Promise.resolve([])
                        }
                    }),
                    where: () => {
                        if (callCount === 2) return Promise.resolve(mockSeatPlans) // 2. seatPlans
                        if (callCount === 3) return Promise.resolve(mockSchoolsWithSeats) // 3. schoolsWithSeats
                        if (callCount === 4) return Promise.resolve(mockSchoolCount) // 4. schoolCount
                        if (callCount === 6) return Promise.resolve(mockStudentCount) // 6. studentCount
                        if (callCount === 7) return Promise.resolve(mockAdminCount) // 7. adminCount
                        if (callCount === 8) return Promise.resolve(mockPreceptorCount) // 8. preceptorCount
                        if (callCount === 9) return Promise.resolve(mockActiveSubCount) // 9. activeSubCount
                        return Promise.resolve([])
                    },
                    // For userCount (call 5), it's just .from(users) then awaited
                    then: (cb: any) => {
                        if (callCount === 5) return cb(mockUserCount)
                        return cb([])
                    }
                }
            }

            return chain
        })

        const stats = await getSystemStats()

        // Assertions
        // Student MRR: $20 + $20 = $40
        // School MRR: (5 * $10) + (10 * $10) = $150
        // Total MRR: $190

        expect(stats.revenue.studentMrr).toBe(40)
        expect(stats.revenue.schoolMrr).toBe(150)
        expect(stats.revenue.totalMrr).toBe(190)

        expect(stats.counts.schools).toBe(10)
        expect(stats.counts.users.total).toBe(100)
        expect(stats.counts.users.students).toBe(80)
        expect(stats.counts.activeSubscriptions).toBe(50)
    })
})
