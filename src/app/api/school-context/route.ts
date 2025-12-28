import { NextResponse } from "next/server"
import { getSchoolContext } from "../../../lib/school-utils"
import { cacheIntegrationService } from "@/lib/cache-integration"

export async function GET() {
  try {
    // Try to get cached data (not response)
    const cachedData = await cacheIntegrationService.get("school-context-data")

    if (cachedData) {
      return NextResponse.json(cachedData)
    }

    // If not cached, fetch fresh data
    const schoolContext = await getSchoolContext()

    // Cache the data (not the response)
    await cacheIntegrationService.set("school-context-data", schoolContext, { ttl: 300 })

    return NextResponse.json(schoolContext)
  } catch (error) {
    console.error("Error fetching school context:", error)
    return NextResponse.json({ error: "Failed to fetch school context" }, { status: 500 })
  }
}

