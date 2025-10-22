import { count, desc, eq } from "drizzle-orm"
import { redirect } from "next/navigation"
import { db } from "@/database/db"
import { competencyTemplates, rubricCriteria, users } from "@/database/schema"
import { getCurrentUser } from "@/lib/auth-clerk"
import { CompetencyTemplatesContent } from "./templates-client"

// Server component to fetch templates from database
export default async function CompetencyTemplatesPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/auth/sign-in")
  }

  // Fetch competency templates from database
  const templates = await db
    .select({
      id: competencyTemplates.id,
      name: competencyTemplates.name,
      description: competencyTemplates.description,
      category: competencyTemplates.category,
      level: competencyTemplates.level,
      type: competencyTemplates.type,
      source: competencyTemplates.source,
      version: competencyTemplates.version,
      isActive: competencyTemplates.isActive,
      metadata: competencyTemplates.metadata,
      createdBy: competencyTemplates.createdBy,
      createdAt: competencyTemplates.createdAt,
      updatedAt: competencyTemplates.updatedAt,
      authorName: users.name,
      tags: competencyTemplates.tags,
      content: competencyTemplates.content,
      isPublic: competencyTemplates.isPublic,
    })
    .from(competencyTemplates)
    .leftJoin(users, eq(competencyTemplates.createdBy, users.id))
    .where(eq(competencyTemplates.isActive, true))
    .orderBy(desc(competencyTemplates.createdAt))

  // Get rubric counts for each template
  const templatesWithCounts = await Promise.all(
    templates.map(async (template) => {
      const rubricCount = await db
        .select({ count: count() })
        .from(rubricCriteria)
        .where(eq(rubricCriteria.templateId, template.id))
        .then((result) => result[0]?.count || 0)

      // Parse metadata and tags
      let metadata = {}
      let tags: string[] = []
      let content = {}

      try {
        metadata = template.metadata ? JSON.parse(template.metadata) : {}
        tags = template.tags ? JSON.parse(template.tags) : []
        content = template.content ? JSON.parse(template.content) : {}
      } catch (error) {
        console.error("Error parsing template data:", error)
      }

      return {
        ...template,
        author: template.authorName || "Unknown",
        competencyCount: Math.floor(Math.random() * 20) + 5, // Placeholder until we have competency counts
        rubricCount,
        downloads: Math.floor(Math.random() * 1000) + 100, // Placeholder
        rating: Math.floor(Math.random() * 2) + 4, // 4-5 stars
        tags,
        content,
        metadata,
        createdAt: template.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: template.updatedAt?.toISOString() || new Date().toISOString(),
      }
    })
  )

  // Calculate stats
  const stats = {
    total: templatesWithCounts.length,
    categories: [...new Set(templatesWithCounts.map((t) => t.category))].length,
    levels: [...new Set(templatesWithCounts.map((t) => t.level))].length,
    types: [...new Set(templatesWithCounts.map((t) => t.type))].length,
  }

  return <CompetencyTemplatesContent templates={templatesWithCounts} stats={stats} />
}
