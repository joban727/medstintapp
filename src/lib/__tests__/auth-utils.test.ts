import { describe, it, expect } from "vitest"
import { getRoleDashboardUrl } from "../auth-utils"

describe("auth-utils", () => {
  describe("getRoleDashboardUrl", () => {
    it("returns admin dashboard for SUPER_ADMIN", () => {
      expect(getRoleDashboardUrl("SUPER_ADMIN")).toBe("/dashboard/admin")
    })

    it("returns school admin dashboard for SCHOOL_ADMIN", () => {
      expect(getRoleDashboardUrl("SCHOOL_ADMIN")).toBe("/dashboard/school-admin")
    })

    it("returns student dashboard for STUDENT", () => {
      expect(getRoleDashboardUrl("STUDENT")).toBe("/dashboard/student")
    })

    it("returns default dashboard for null role", () => {
      expect(getRoleDashboardUrl(null)).toBe("/dashboard")
    })
  })
})
