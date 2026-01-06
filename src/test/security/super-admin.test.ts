import { describe, it, expect } from "vitest"
import { canCreateRole, canModifyRole } from "../../lib/rbac-middleware"
import type { UserRole } from "../../types"

describe("Super Admin Security", () => {
    describe("canCreateRole", () => {
        it("should prevent creating a SUPER_ADMIN role", () => {
            // Even a SUPER_ADMIN cannot create another SUPER_ADMIN via this function
            // (The script bypasses this by writing directly to DB, which is intended)
            expect(canCreateRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(false)
            expect(canCreateRole("SCHOOL_ADMIN", "SUPER_ADMIN")).toBe(false)
            expect(canCreateRole("SYSTEM", "SUPER_ADMIN")).toBe(false)
        })

        it("should allow SUPER_ADMIN to create other roles", () => {
            expect(canCreateRole("SUPER_ADMIN", "SCHOOL_ADMIN")).toBe(true)
            expect(canCreateRole("SUPER_ADMIN", "STUDENT")).toBe(true)
        })
    })

    describe("canModifyRole", () => {
        it("should prevent promoting anyone to SUPER_ADMIN", () => {
            // Even a SUPER_ADMIN cannot promote someone else to SUPER_ADMIN via this function
            expect(canModifyRole("SUPER_ADMIN", "SCHOOL_ADMIN", "SUPER_ADMIN")).toBe(false)
            expect(canModifyRole("SCHOOL_ADMIN", "STUDENT", "SUPER_ADMIN")).toBe(false)
        })

        it("should allow SUPER_ADMIN to modify other roles", () => {
            expect(canModifyRole("SUPER_ADMIN", "STUDENT", "SCHOOL_ADMIN")).toBe(true)
        })
    })
})
