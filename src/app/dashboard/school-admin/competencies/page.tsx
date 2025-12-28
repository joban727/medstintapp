import { redirect } from "next/navigation"

// Competencies are now managed per-program from the Programs page
// This redirects to maintain any old bookmarks/links
export default function CompetenciesRedirectPage() {
  redirect("/dashboard/school-admin/programs")
}
