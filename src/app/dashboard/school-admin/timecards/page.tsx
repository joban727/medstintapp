import { redirect } from "next/navigation"

/**
 * Timecard monitoring page - redirects to time-records for consistency
 * This maintains backward compatibility while using the existing implementation
 */
export default function TimecardPage() {
  redirect("/dashboard/school-admin/time-records")
}
