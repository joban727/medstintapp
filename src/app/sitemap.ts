import { MetadataRoute } from "next"
import { db } from "@/database/connection-pool"
import { schools, programs } from "@/database/schema"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // Static routes
  const staticRoutes = [
    "",
    "/auth/sign-in",
    "/auth/sign-up",
    "/about",
    "/contact",
    "/pricing",
    "/terms",
    "/privacy",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: route === "" ? 1 : 0.8,
  }))

  // Dynamic routes - Schools
  const allSchools = await db.select({ id: schools.id }).from(schools)
  const schoolRoutes = allSchools.map((school) => ({
    url: `${baseUrl}/schools/${school.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }))

  // Dynamic routes - Programs
  const allPrograms = await db.select({ id: programs.id }).from(programs)
  const programRoutes = allPrograms.map((program) => ({
    url: `${baseUrl}/programs/${program.id}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }))

  return [...staticRoutes, ...schoolRoutes, ...programRoutes]
}
