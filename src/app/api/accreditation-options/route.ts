import { type NextRequest, NextResponse } from "next/server"
import { cacheIntegrationService } from '@/lib/cache-integration'


// Accreditation options for medical education programs
const accreditationOptions = [
  {
    id: "lcme",
    name: "LCME",
    fullName: "Liaison Committee on Medical Education",
    description: "Accredits medical education programs leading to the MD degree",
    type: "medical",
  },
  {
    id: "coca",
    name: "COCA",
    fullName: "Commission on Osteopathic College Accreditation",
    description: "Accredits osteopathic medical education programs leading to the DO degree",
    type: "osteopathic",
  },
  {
    id: "acgme",
    name: "ACGME",
    fullName: "Accreditation Council for Graduate Medical Education",
    description: "Accredits graduate medical education programs",
    type: "graduate",
  },
  {
    id: "ccne",
    name: "CCNE",
    fullName: "Commission on Collegiate Nursing Education",
    description: "Accredits nursing education programs",
    type: "nursing",
  },
  {
    id: "acen",
    name: "ACEN",
    fullName: "Accreditation Commission for Education in Nursing",
    description: "Accredits nursing education programs",
    type: "nursing",
  },
]

export async function GET(request: NextRequest) {
  try {
    // Try to get cached response
    const cached = await cacheIntegrationService.cachedApiResponse(
      'api:accreditation-options/route.ts',
      async () => {
        // Original function logic will be wrapped here
        return await executeOriginalLogic()
      },
      300 // 5 minutes TTL
    )
    
    if (cached) {
      return cached
    }
  } catch (cacheError) {
    console.warn('Cache error in accreditation-options/route.ts:', cacheError)
    // Continue with original logic if cache fails
  }
  
  async function executeOriginalLogic() {

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get("type")

    let filteredOptions = accreditationOptions

    if (type) {
      filteredOptions = accreditationOptions.filter((option) => option.type === type)
    }

    return NextResponse.json({
      success: true,
      data: filteredOptions,
    })
  } catch (error) {
    console.error("Error fetching accreditation options:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch accreditation options",
      },
      { status: 500 }
    )
  }

  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, fullName, description, type } = body

    // Validate required fields
    if (!name || !fullName || !description || !type) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name, fullName, description, type",
        },
        { status: 400 }
      )
    }

    // In a real application, you would save this to a database
    const newOption = {
      id: name.toLowerCase().replace(/\s+/g, "-"),
      name,
      fullName,
      description,
      type,
    }

    return NextResponse.json({
      success: true,
      data: newOption,
      message: "Accreditation option created successfully",
    })
  } catch (error) {
    console.error("Error creating accreditation option:", error)
    
    // Invalidate related caches
    try {
      await cacheIntegrationService.invalidateAllCache()
    } catch (cacheError) {
      console.warn('Cache invalidation error in accreditation-options/route.ts:', cacheError)
    }
    
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create accreditation option",
      },
      { status: 500 }
    )
  }
}
